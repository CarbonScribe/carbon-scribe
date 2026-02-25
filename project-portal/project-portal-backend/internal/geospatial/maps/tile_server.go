package maps

import "fmt"

func TileKey(z, x, y int, style string) string {
	return fmt.Sprintf("%d/%d/%d/%s", z, x, y, style)
}
