package sales

import "math"

func DutchAuctionPrice(startPrice, floorPrice float64, step, maxSteps int) float64 {
	if step <= 0 || maxSteps <= 0 {
		return startPrice
	}
	if startPrice < floorPrice {
		return floorPrice
	}
	delta := (startPrice - floorPrice) / float64(maxSteps)
	price := startPrice - (delta * float64(step))
	if price < floorPrice {
		price = floorPrice
	}
	return math.Round(price*10000) / 10000
}

func SealedBidClearingPrice(bids []float64) float64 {
	if len(bids) == 0 {
		return 0
	}
	best := bids[0]
	for _, bid := range bids[1:] {
		if bid > best {
			best = bid
		}
	}
	return math.Round(best*10000) / 10000
}
