package security

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// BodyLimit returns Gin middleware enforcing a maximum request body size
// (#797), instead of letting any of the handlers that bind JSON or read the
// body (ShouldBindJSON, io.ReadAll, ...) buffer an arbitrarily large payload
// into memory.
//
// Applying it more than once to the same request (e.g. a global default
// plus a looser limit on an upload route group) is intentional and safe:
// the most specific — i.e. last-registered, since Gin runs parent-group
// middleware before child-group middleware — BodyLimit call wins, replacing
// the active limit rather than stacking a second wrapper on top of the
// first. A naive second http.MaxBytesReader wrapped around an
// already-limited reader could only ever make the effective limit
// *stricter*, never looser, which would make a larger per-route override
// impossible.
//
// When the limit is exceeded, the wrapped reader itself writes a 413
// Payload Too Large JSON response and unwinds out of the handler via a
// recovered panic — not by returning the error up through
// ShouldBindJSON/io.ReadAll and relying on ~94 existing call sites to each
// recognize *http.MaxBytesError, most of which currently turn any bind
// error into a generic 400. This runs the handler's own "if err != nil"
// error-response code never executes at all for this specific error, so
// there is no double response write.
func BodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if existing, ok := c.Request.Body.(*limitedBody); ok {
			existing.maxBytes = maxBytes
			existing.ReadCloser = http.MaxBytesReader(c.Writer, existing.underlying, maxBytes)
		} else {
			body := &limitedBody{
				underlying: c.Request.Body,
				maxBytes:   maxBytes,
				ctx:        c,
			}
			body.ReadCloser = http.MaxBytesReader(c.Writer, body.underlying, maxBytes)
			c.Request.Body = body
		}

		defer func() {
			if r := recover(); r != nil {
				if _, ok := r.(bodyTooLargeAbort); ok {
					return // the 413 response was already written by Read()
				}
				panic(r)
			}
		}()
		c.Next()
	}
}

// bodyTooLargeAbort is the panic value Read uses to unwind out of whatever
// handler code is mid-bind the moment the limit is tripped, so that code's
// own (already-written-over) error-response branch never executes.
type bodyTooLargeAbort struct{}

type limitedBody struct {
	io.ReadCloser // the currently-active http.MaxBytesReader-wrapped reader
	underlying    io.ReadCloser
	ctx           *gin.Context
	maxBytes      int64
	responded     bool
}

func (b *limitedBody) Read(p []byte) (int, error) {
	n, err := b.ReadCloser.Read(p)
	if err == nil {
		return n, nil
	}

	var maxBytesErr *http.MaxBytesError
	if !errors.As(err, &maxBytesErr) {
		return n, err
	}

	if !b.responded {
		b.responded = true
		b.ctx.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
			"error": fmt.Sprintf("request body exceeds the maximum allowed size of %d bytes", b.maxBytes),
		})
	}
	panic(bodyTooLargeAbort{})
}
