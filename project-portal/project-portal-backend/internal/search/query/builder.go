package query

// Builder helps construct Elasticsearch queries
type Builder struct {
	query map[string]interface{}
}

// NewBuilder creates a new query builder
func NewBuilder() *Builder {
	return &Builder{
		query: make(map[string]interface{}),
	}
}

// Term adds a term query
func (b *Builder) Term(field string, value interface{}) *Builder {
	b.query["term"] = map[string]interface{}{
		field: value,
	}
	return b
}

// Range adds a range query
func (b *Builder) Range(field string, gte, lte interface{}) *Builder {
	r := map[string]interface{}{}
	if gte != nil {
		r["gte"] = gte
	}
	if lte != nil {
		r["lte"] = lte
	}
	b.query["range"] = map[string]interface{}{
		field: r,
	}
	return b
}

// Bool creates a boolean query
type BoolBuilder struct {
	must    []interface{}
	mustNot []interface{}
	filter  []interface{}
	should  []interface{}
}

func NewBoolBuilder() *BoolBuilder {
	return &BoolBuilder{}
}

func (bb *BoolBuilder) Must(query map[string]interface{}) *BoolBuilder {
	bb.must = append(bb.must, query)
	return bb
}

func (bb *BoolBuilder) Filter(query map[string]interface{}) *BoolBuilder {
	bb.filter = append(bb.filter, query)
	return bb
}

func (bb *BoolBuilder) Build() map[string]interface{} {
	m := map[string]interface{}{}
	if len(bb.must) > 0 {
		m["must"] = bb.must
	}
	if len(bb.mustNot) > 0 {
		m["must_not"] = bb.mustNot
	}
	if len(bb.filter) > 0 {
		m["filter"] = bb.filter
	}
	if len(bb.should) > 0 {
		m["should"] = bb.should
	}
	return map[string]interface{}{"bool": m}
}

// From sets from/offset
func (b *Builder) From(from int) *Builder {
	b.query["from"] = from
	return b
}

// Size sets size/limit
func (b *Builder) Size(size int) *Builder {
	b.query["size"] = size
	return b
}

// Sort adds sort
func (b *Builder) Sort(field string, value interface{}) *Builder {
	var sortVal interface{}
	if order, ok := value.(string); ok {
		sortVal = map[string]interface{}{"order": order}
	} else {
		sortVal = value
	}

	b.query["sort"] = []map[string]interface{}{
		{field: sortVal},
	}
	return b
}

// Build returns the constructed query map
func (b *Builder) Build() map[string]interface{} {
	return b.query
}

// WithQuery sets the main query part
func (b *Builder) WithQuery(query map[string]interface{}) *Builder {
	b.query["query"] = query
	return b
}

// Aggregate adds an aggregation
func (b *Builder) Aggregate(name, field string) *Builder {
	if _, ok := b.query["aggs"]; !ok {
		b.query["aggs"] = make(map[string]interface{})
	}
	b.query["aggs"].(map[string]interface{})[name] = map[string]interface{}{
		"terms": map[string]interface{}{
			"field": field,
		},
	}
	return b
}

func (bb *BoolBuilder) GeoDistance(field string, lat, lon float64, distance string) *BoolBuilder {
	bb.filter = append(bb.filter, map[string]interface{}{
		"geo_distance": map[string]interface{}{
			"distance": distance,
			field: map[string]interface{}{
				"lat": lat,
				"lon": lon,
			},
		},
	})
	return bb
}
