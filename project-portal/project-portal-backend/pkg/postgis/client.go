package postgis

import "gorm.io/gorm"

type Client struct {
	db *gorm.DB
}

func NewClient(db *gorm.DB) *Client {
	return &Client{db: db}
}

func (c *Client) DB() *gorm.DB {
	return c.db
}
