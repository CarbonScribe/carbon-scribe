package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Submission struct {
	QuestID string `json:"quest_id"`
	Proof   string `json:"proof"`
}

var submissions []Submission

func SubmitQuest(c *gin.Context) {
	var s Submission
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, sub := range submissions {
		if sub.QuestID == s.QuestID {
			c.JSON(http.StatusConflict, gin.H{"error": "quest already submitted"})
			return
		}
	}

	submissions = append(submissions, s)
	c.JSON(http.StatusOK, gin.H{
		"message":  "submission received",
		"quest_id": s.QuestID,
	})
}

func ListSubmissions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"submissions": submissions})
}
