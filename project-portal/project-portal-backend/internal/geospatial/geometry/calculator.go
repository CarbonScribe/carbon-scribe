package geometry

const HectaresPerSquareMeter = 0.0001

func ToHectares(squareMeters float64) float64 {
	return squareMeters * HectaresPerSquareMeter
}
