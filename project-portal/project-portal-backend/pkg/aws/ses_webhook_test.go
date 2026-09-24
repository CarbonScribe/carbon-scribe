package aws

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1" //nolint:gosec // matches SNS SignatureVersion 1, same as production code
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testSigner bundles a self-signed RSA cert/key pair used to produce
// validly-signed SNS test messages, mimicking what a real SNS signing
// certificate looks like.
type testSigner struct {
	key     *rsa.PrivateKey
	certPEM []byte
}

func newTestSigner(t *testing.T) *testSigner {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "sns.amazonaws.com"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		IsCA:         true,
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)

	return &testSigner{
		key:     key,
		certPEM: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
	}
}

// sign signs msg's canonical string and sets msg.Signature (base64) and a
// SignatureVersion of "1", as SNS itself would.
func (s *testSigner) sign(t *testing.T, msg *SNSMessage) {
	t.Helper()
	msg.SignatureVersion = "1"
	hashed := sha1.Sum([]byte(canonicalStringForSigning(msg))) //nolint:gosec
	sig, err := rsa.SignPKCS1v15(rand.Reader, s.key, crypto.SHA1, hashed[:])
	require.NoError(t, err)
	msg.Signature = base64.StdEncoding.EncodeToString(sig)
}

func TestValidateAmazonHTTPSURL(t *testing.T) {
	cases := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"valid sns url", "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem", false},
		{"valid uppercase host", "https://SNS.us-east-1.AMAZONAWS.COM/cert.pem", false},
		{"http rejected", "http://sns.us-east-1.amazonaws.com/cert.pem", true},
		{"non-amazon host rejected", "https://evil.example.com/cert.pem", true},
		{"amazonaws.com.evil.com rejected", "https://sns.amazonaws.com.evil.com/cert.pem", true},
		{"malformed url rejected", "://not-a-url", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateAmazonHTTPSURL(tc.url)
			if tc.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestCanonicalStringForSigning_Notification(t *testing.T) {
	msg := &SNSMessage{
		Type:      "Notification",
		MessageId: "msg-1",
		TopicArn:  "arn:aws:sns:us-east-1:123:topic",
		Subject:   "test subject",
		Message:   `{"notificationType":"Bounce"}`,
		Timestamp: "2024-01-01T00:00:00.000Z",
	}
	expected := "Message\n{\"notificationType\":\"Bounce\"}\nMessageId\nmsg-1\nSubject\ntest subject\nTimestamp\n2024-01-01T00:00:00.000Z\nTopicArn\narn:aws:sns:us-east-1:123:topic\nType\nNotification\n"
	assert.Equal(t, expected, canonicalStringForSigning(msg))
}

func TestCanonicalStringForSigning_NotificationWithoutSubject(t *testing.T) {
	msg := &SNSMessage{
		Type:      "Notification",
		MessageId: "msg-1",
		TopicArn:  "arn:aws:sns:us-east-1:123:topic",
		Message:   `{}`,
		Timestamp: "2024-01-01T00:00:00.000Z",
	}
	assert.NotContains(t, canonicalStringForSigning(msg), "Subject")
}

func TestCanonicalStringForSigning_SubscriptionConfirmation(t *testing.T) {
	msg := &SNSMessage{
		Type:         "SubscriptionConfirmation",
		MessageId:    "msg-2",
		TopicArn:     "arn:aws:sns:us-east-1:123:topic",
		Message:      "You have chosen to subscribe...",
		SubscribeURL: "https://sns.us-east-1.amazonaws.com/confirm?token=abc",
		Token:        "abc",
		Timestamp:    "2024-01-01T00:00:00.000Z",
	}
	expected := "Message\nYou have chosen to subscribe...\nMessageId\nmsg-2\nSubscribeURL\nhttps://sns.us-east-1.amazonaws.com/confirm?token=abc\nTimestamp\n2024-01-01T00:00:00.000Z\nToken\nabc\nTopicArn\narn:aws:sns:us-east-1:123:topic\nType\nSubscriptionConfirmation\n"
	assert.Equal(t, expected, canonicalStringForSigning(msg))
}

func TestVerifySNSSignature_ValidSignaturePasses(t *testing.T) {
	signer := newTestSigner(t)
	msg := &SNSMessage{
		Type:           "Notification",
		MessageId:      "msg-1",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        `{"notificationType":"Delivery"}`,
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
	}
	signer.sign(t, msg)

	fakeGet := func(url string) ([]byte, error) {
		assert.Equal(t, msg.SigningCertURL, url)
		return signer.certPEM, nil
	}

	err := verifySNSSignature(msg, fakeGet)
	assert.NoError(t, err)
}

func TestVerifySNSSignature_TamperedMessageFails(t *testing.T) {
	signer := newTestSigner(t)
	msg := &SNSMessage{
		Type:           "Notification",
		MessageId:      "msg-1",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        `{"notificationType":"Delivery"}`,
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
	}
	signer.sign(t, msg)

	// Tamper with the message after signing.
	msg.Message = `{"notificationType":"Bounce"}`

	fakeGet := func(url string) ([]byte, error) { return signer.certPEM, nil }

	err := verifySNSSignature(msg, fakeGet)
	assert.Error(t, err)
}

func TestVerifySNSSignature_RejectsNonAmazonCertURL(t *testing.T) {
	signer := newTestSigner(t)
	msg := &SNSMessage{
		Type:           "Notification",
		MessageId:      "msg-1",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        `{}`,
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://evil.example.com/cert.pem",
	}
	signer.sign(t, msg)

	called := false
	fakeGet := func(url string) ([]byte, error) {
		called = true
		return signer.certPEM, nil
	}

	err := verifySNSSignature(msg, fakeGet)
	assert.Error(t, err)
	assert.False(t, called, "must never fetch a non-amazonaws.com cert URL")
}

func TestVerifySNSSignature_RejectsUnsupportedVersion(t *testing.T) {
	msg := &SNSMessage{SignatureVersion: "2"}
	err := verifySNSSignature(msg, func(string) ([]byte, error) { return nil, nil })
	assert.Error(t, err)
}

func TestProcessSESWebhook_ConfirmsSubscription(t *testing.T) {
	signer := newTestSigner(t)
	msg := &SNSMessage{
		Type:           "SubscriptionConfirmation",
		MessageId:      "msg-3",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        "You have chosen to subscribe...",
		SubscribeURL:   "https://sns.us-east-1.amazonaws.com/confirm?token=abc",
		Token:          "abc",
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
	}
	signer.sign(t, msg)
	body, err := json.Marshal(msg)
	require.NoError(t, err)

	var confirmedURL string
	envelope, notification, err := processSESWebhookBody(body, SESWebhookHandlers{}, func(url string) ([]byte, error) {
		if url == msg.SigningCertURL {
			return signer.certPEM, nil
		}
		confirmedURL = url
		return []byte("ok"), nil
	})

	assert.NoError(t, err)
	assert.Nil(t, notification)
	assert.Equal(t, "SubscriptionConfirmation", envelope.Type)
	assert.Equal(t, msg.SubscribeURL, confirmedURL)
}

func TestProcessSESWebhook_DispatchesBounce(t *testing.T) {
	signer := newTestSigner(t)
	innerMessage := SESNotification{
		NotificationType: "Bounce",
		Mail:             SESMail{MessageId: "mail-1", Source: "sender@example.com", Destination: []string{"user@example.com"}},
		Bounce: &SESBounce{
			BounceType:    "Permanent",
			BounceSubType: "General",
			BouncedRecipients: []SESBouncedRecipient{
				{EmailAddress: "user@example.com", Status: "5.1.1"},
			},
		},
	}
	innerJSON, err := json.Marshal(innerMessage)
	require.NoError(t, err)

	msg := &SNSMessage{
		Type:           "Notification",
		MessageId:      "msg-4",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        string(innerJSON),
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
	}
	signer.sign(t, msg)
	body, err := json.Marshal(msg)
	require.NoError(t, err)

	var gotBounce SESBounce
	var gotMail SESMail
	handlers := SESWebhookHandlers{
		OnBounce: func(b SESBounce, m SESMail) {
			gotBounce = b
			gotMail = m
		},
	}

	_, notification, err := processSESWebhookBody(body, handlers, func(url string) ([]byte, error) {
		return signer.certPEM, nil
	})

	assert.NoError(t, err)
	require.NotNil(t, notification)
	assert.Equal(t, "Bounce", notification.NotificationType)
	assert.Equal(t, "Permanent", gotBounce.BounceType)
	assert.Equal(t, "mail-1", gotMail.MessageId)
	assert.Equal(t, "user@example.com", gotBounce.BouncedRecipients[0].EmailAddress)
}

func TestProcessSESWebhook_DispatchesComplaint(t *testing.T) {
	signer := newTestSigner(t)
	innerMessage := SESNotification{
		NotificationType: "Complaint",
		Mail:             SESMail{MessageId: "mail-2"},
		Complaint: &SESComplaint{
			ComplaintFeedbackType: "abuse",
			ComplainedRecipients:  []SESComplainedRecipient{{EmailAddress: "user@example.com"}},
		},
	}
	innerJSON, err := json.Marshal(innerMessage)
	require.NoError(t, err)

	msg := &SNSMessage{
		Type:           "Notification",
		MessageId:      "msg-5",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        string(innerJSON),
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
	}
	signer.sign(t, msg)
	body, err := json.Marshal(msg)
	require.NoError(t, err)

	var gotComplaint SESComplaint
	handlers := SESWebhookHandlers{
		OnComplaint: func(c SESComplaint, m SESMail) { gotComplaint = c },
	}

	_, notification, err := processSESWebhookBody(body, handlers, func(url string) ([]byte, error) {
		return signer.certPEM, nil
	})

	assert.NoError(t, err)
	require.NotNil(t, notification)
	assert.Equal(t, "abuse", gotComplaint.ComplaintFeedbackType)
}

func TestProcessSESWebhook_RejectsInvalidSignature(t *testing.T) {
	signer := newTestSigner(t)
	msg := &SNSMessage{
		Type:           "Notification",
		MessageId:      "msg-6",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        `{"notificationType":"Delivery"}`,
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
		Signature:      "not-valid-base64-signature!!!",
	}
	msg.SignatureVersion = "1"
	body, err := json.Marshal(msg)
	require.NoError(t, err)

	handlerCalled := false
	handlers := SESWebhookHandlers{OnDelivery: func(SESDelivery, SESMail) { handlerCalled = true }}

	_, _, err = processSESWebhookBody(body, handlers, func(url string) ([]byte, error) {
		return signer.certPEM, nil
	})

	assert.Error(t, err)
	assert.False(t, handlerCalled)
}

func TestProcessSESWebhook_RejectsMalformedBody(t *testing.T) {
	_, _, err := processSESWebhookBody([]byte("not json"), SESWebhookHandlers{}, func(string) ([]byte, error) { return nil, nil })
	assert.Error(t, err)
}

func TestProcessSESWebhook_UnsubscribeConfirmationIsAcknowledged(t *testing.T) {
	signer := newTestSigner(t)
	msg := &SNSMessage{
		Type:           "UnsubscribeConfirmation",
		MessageId:      "msg-7",
		TopicArn:       "arn:aws:sns:us-east-1:123:topic",
		Message:        "You have unsubscribed...",
		SubscribeURL:   "https://sns.us-east-1.amazonaws.com/resubscribe?token=xyz",
		Token:          "xyz",
		Timestamp:      "2024-01-01T00:00:00.000Z",
		SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
	}
	signer.sign(t, msg)
	body, err := json.Marshal(msg)
	require.NoError(t, err)

	envelope, notification, err := processSESWebhookBody(body, SESWebhookHandlers{}, func(url string) ([]byte, error) {
		return signer.certPEM, nil
	})

	assert.NoError(t, err)
	assert.Nil(t, notification)
	assert.Equal(t, "UnsubscribeConfirmation", envelope.Type)
}

func TestFetchURLRejectsUnreachableURL(t *testing.T) {
	_, err := fetchURL("not-a-real-url")
	assert.Error(t, err)
}
