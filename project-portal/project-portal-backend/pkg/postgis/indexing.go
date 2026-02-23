package postgis

import "gorm.io/gorm"

func EnsureIndex(db *gorm.DB, sql string) error {
	return db.Exec(sql).Error
}
