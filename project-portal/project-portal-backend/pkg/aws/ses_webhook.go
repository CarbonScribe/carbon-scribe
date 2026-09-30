package aws

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha1" //nolint:gosec // SHA-1 is what SNS's SignatureVersion "1" scheme actually signs with; required for verification, not a design choice.
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// SNSMessage is the raw envelope AWS SNS POSTs for every message type
// (SubscriptionConfirmation, Notification, UnsubscribeConfirmation) to a
// topic's HTTPS subscriber.
type SNSMessage struct {
	Type             string `json:"Type"`
	MessageId        string `json:"MessageId"`
	TopicArn         string `json:"TopicArn"`
	Subject          string `json:"Subject,omitempty"`
	Message          string `json:"Message"`
	Timestamp        string `json:"Timestamp"`
	SignatureVersion string `json:"SignatureVersion"`
	Signature        string `json:"Signature"`
	SigningCertURL   string `json:"SigningCertURL"`
	SubscribeURL     string `json:"SubscribeURL,omitempty"`
	Token            string `json:"Token,omitempty"`
	UnsubscribeURL   string `json:"UnsubscribeURL,omitempty"`
}

const (
	snsMessageTypeSubscriptionConfirmation = "SubscriptionConfirmation"
	snsMessageTypeNotification             = "Notification"
	snsMessageTypeUnsubscribeConfirmation  = "UnsubscribeConfirmation"
)

// SESMail is the common "mail" object present on every SES event type.
type SESMail struct {
	Timestamp   string   `json:"timestamp"`
	MessageId   string   `json:"messageId"`
	Source      string   `json:"source"`
	Destination []string `json:"destination"`
}

// SESBouncedRecipient is one recipient a bounce notification applies to.
type SESBouncedRecipient struct {
	EmailAddress   string `json:"emailAddress"`
	Status         string `json:"status,omitempty"`
	DiagnosticCode string `json:"diagnosticCode,omitempty"`
}

// SESBounce is the "bounce" object on an SES Bounce notification.
type SESBounce struct {
	BounceType        string                `json:"bounceType"` // "Permanent", "Transient", "Undetermined"
	BounceSubType     string                `json:"bounceSubType"`
	Timestamp         string                `json:"timestamp"`
	FeedbackId        string                `json:"feedbackId"`
	BouncedRecipients []SESBouncedRecipient `json:"bouncedRecipients"`
}

// SESComplainedRecipient is one recipient a complaint notification applies to.
type SESComplainedRecipient struct {
	EmailAddress string `json:"emailAddress"`
}

// SESComplaint is the "complaint" object on an SES Complaint notification.
type SESComplaint struct {
	Timestamp             string                   `json:"timestamp"`
	FeedbackId            string                   `json:"feedbackId"`
	ComplaintFeedbackType string                   `json:"complaintFeedbackType,omitempty"`
	ComplainedRecipients  []SESComplainedRecipient `json:"complainedRecipients"`
}

// SESDelivery is the "delivery" object on an SES Delivery notification.
type SESDelivery struct {
	Timestamp  string   `json:"timestamp"`
	Recipients []string `json:"recipients"`
}

// SESNotification is the decoded SES event delivered inside an SNS
// Notification message's Message field (itself a JSON string).
type SESNotification struct {
	NotificationType string        `json:"notificationType"` // "Bounce", "Complaint", "Delivery"
	Mail             SESMail       `json:"mail"`
	Bounce           *SESBounce    `json:"bounce,omitempty"`
	Complaint        *SESComplaint `json:"complaint,omitempty"`
	Delivery         *SESDelivery  `json:"delivery,omitempty"`
}

// SESWebhookHandlers are invoked for each parsed SES event. Any field may be
// left nil, in which case that event type is still verified and logged, just
// not otherwise acted on.
type SESWebhookHandlers struct {
	OnBounce    func(SESBounce, SESMail)
	OnComplaint func(SESComplaint, SESMail)
	OnDelivery  func(SESDelivery, SESMail)
}

// ProcessSESWebhook parses and cryptographically verifies a raw SNS
// HTTPS-subscription POST body, confirms a pending subscription, and
// dispatches Notification events (bounce/complaint/delivery) to handlers.
// It returns the parsed envelope and (for Notification messages) the
// decoded SES event, and an error for any unverifiable or malformed
// message — callers should respond with a non-2xx status in that case so
// SNS retries delivery.
func ProcessSESWebhook(body []byte, handlers SESWebhookHandlers) (*SNSMessage, *SESNotification, error) {
	return processSESWebhookBody(body, handlers, fetchURL)
}

func processSESWebhookBody(body []byte, handlers SESWebhookHandlers, httpGet func(string) ([]byte, error)) (*SNSMessage, *SESNotification, error) {
	var msg SNSMessage
	if err := json.Unmarshal(body, &msg); err != nil {
		return nil, nil, fmt.Errorf("decode SNS envelope: %w", err)
	}

	if err := verifySNSSignature(&msg, httpGet); err != nil {
		return &msg, nil, fmt.Errorf("verify SNS signature: %w", err)
	}

	switch msg.Type {
	case snsMessageTypeSubscriptionConfirmation:
		if err := confirmSNSSubscription(msg.SubscribeURL, httpGet); err != nil {
			return &msg, nil, err
		}
		return &msg, nil, nil

	case snsMessageTypeUnsubscribeConfirmation:
		log.Printf("[SES] received SNS unsubscribe confirmation for topic %s", msg.TopicArn)
		return &msg, nil, nil

	case snsMessageTypeNotification:
		notification, err := dispatchSESNotification(msg.Message, handlers)
		return &msg, notification, err

	default:
		return &msg, nil, fmt.Errorf("unsupported SNS message type %q", msg.Type)
	}
}

func confirmSNSSubscription(subscribeURL string, httpGet func(string) ([]byte, error)) error {
	if err := validateAmazonHTTPSURL(subscribeURL); err != nil {
		return fmt.Errorf("invalid SubscribeURL: %w", err)
	}
	if _, err := httpGet(subscribeURL); err != nil {
		return fmt.Errorf("confirm SNS subscription: %w", err)
	}
	log.Printf("[SES] confirmed SNS subscription via %s", subscribeURL)
	return nil
}

func dispatchSESNotification(rawMessage string, handlers SESWebhookHandlers) (*SESNotification, error) {
	var notification SESNotification
	if err := json.Unmarshal([]byte(rawMessage), &notification); err != nil {
		return nil, fmt.Errorf("decode SES notification: %w", err)
	}

	switch notification.NotificationType {
	case "Bounce":
		if notification.Bounce == nil {
			return nil, fmt.Errorf("SES Bounce notification missing bounce details")
		}
		log.Printf("[SES] bounce type=%s subtype=%s recipients=%d message_id=%s",
			notification.Bounce.BounceType, notification.Bounce.BounceSubType,
			len(notification.Bounce.BouncedRecipients), notification.Mail.MessageId)
		if handlers.OnBounce != nil {
			handlers.OnBounce(*notification.Bounce, notification.Mail)
		}

	case "Complaint":
		if notification.Complaint == nil {
			return nil, fmt.Errorf("SES Complaint notification missing complaint details")
		}
		log.Printf("[SES] complaint feedback_type=%s recipients=%d message_id=%s",
			notification.Complaint.ComplaintFeedbackType,
			len(notification.Complaint.ComplainedRecipients), notification.Mail.MessageId)
		if handlers.OnComplaint != nil {
			handlers.OnComplaint(*notification.Complaint, notification.Mail)
		}

	case "Delivery":
		if notification.Delivery != nil {
			log.Printf("[SES] delivery recipients=%d message_id=%s", len(notification.Delivery.Recipients), notification.Mail.MessageId)
			if handlers.OnDelivery != nil {
				handlers.OnDelivery(*notification.Delivery, notification.Mail)
			}
		}

	default:
		log.Printf("[SES] unrecognized SES notification type %q", notification.NotificationType)
	}

	return &notification, nil
}

// verifySNSSignature verifies an SNS message's signature against the
// certificate at its SigningCertURL, per AWS's documented canonical-string
// format (SignatureVersion "1", SHA1-with-RSA). SigningCertURL is required
// to be an HTTPS *.amazonaws.com URL so a forged message can never point us
// at an attacker-controlled certificate.
func verifySNSSignature(msg *SNSMessage, httpGet func(string) ([]byte, error)) error {
	if msg.SignatureVersion != "1" {
		return fmt.Errorf("unsupported SNS signature version %q", msg.SignatureVersion)
	}
	if err := validateAmazonHTTPSURL(msg.SigningCertURL); err != nil {
		return fmt.Errorf("invalid SigningCertURL: %w", err)
	}

	certPEM, err := httpGet(msg.SigningCertURL)
	if err != nil {
		return fmt.Errorf("fetch SNS signing certificate: %w", err)
	}

	block, _ := pem.Decode(certPEM)
	if block == nil {
		return fmt.Errorf("SNS signing certificate is not valid PEM")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fmt.Errorf("parse SNS signing certificate: %w", err)
	}
	pubKey, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("SNS signing certificate does not use an RSA public key")
	}

	signature, err := base64.StdEncoding.DecodeString(msg.Signature)
	if err != nil {
		return fmt.Errorf("decode SNS signature: %w", err)
	}

	hashed := sha1.Sum([]byte(canonicalStringForSigning(msg))) //nolint:gosec // required by SNS SignatureVersion 1
	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA1, hashed[:], signature); err != nil {
		return fmt.Errorf("SNS signature verification failed: %w", err)
	}
	return nil
}

// validateAmazonHTTPSURL rejects anything that isn't an HTTPS URL on an
// *.amazonaws.com host, used for both SigningCertURL and SubscribeURL.
func validateAmazonHTTPSURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("parse URL: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("URL must use https, got %q", u.Scheme)
	}
	if !strings.HasSuffix(strings.ToLower(u.Hostname()), ".amazonaws.com") {
		return fmt.Errorf("host %q is not an amazonaws.com host", u.Hostname())
	}
	return nil
}

// canonicalStringForSigning builds the exact string SNS signs for a given
// message type, per
// https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
func canonicalStringForSigning(msg *SNSMessage) string {
	var b strings.Builder
	writeField := func(name, value string) {
		b.WriteString(name)
		b.WriteString("\n")
		b.WriteString(value)
		b.WriteString("\n")
	}

	if msg.Type == snsMessageTypeNotification {
		writeField("Message", msg.Message)
		writeField("MessageId", msg.MessageId)
		if msg.Subject != "" {
			writeField("Subject", msg.Subject)
		}
		writeField("Timestamp", msg.Timestamp)
		writeField("TopicArn", msg.TopicArn)
		writeField("Type", msg.Type)
	} else {
		// SubscriptionConfirmation / UnsubscribeConfirmation
		writeField("Message", msg.Message)
		writeField("MessageId", msg.MessageId)
		writeField("SubscribeURL", msg.SubscribeURL)
		writeField("Timestamp", msg.Timestamp)
		writeField("Token", msg.Token)
		writeField("TopicArn", msg.TopicArn)
		writeField("Type", msg.Type)
	}
	return b.String()
}

// fetchURL is the default httpGet implementation used outside tests.
func fetchURL(rawURL string) ([]byte, error) {
	resp, err := http.Get(rawURL) //nolint:gosec // URL is validated by validateAmazonHTTPSURL before this is ever called
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
