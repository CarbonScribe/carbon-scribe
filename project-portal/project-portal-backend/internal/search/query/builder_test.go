package query

import (
	"reflect"
	"testing"
)

func TestBuilder_Term(t *testing.T) {
	b := NewBuilder()
	b.Term("status", "active")
	q := b.Build()

	expected := map[string]interface{}{
		"term": map[string]interface{}{
			"status": "active",
		},
	}

	if !reflect.DeepEqual(q, expected) {
		t.Errorf("Expected %v, got %v", expected, q)
	}
}

func TestBuilder_Range(t *testing.T) {
	b := NewBuilder()
	b.Range("age", 18, 30)
	q := b.Build()

	expected := map[string]interface{}{
		"range": map[string]interface{}{
			"age": map[string]interface{}{
				"gte": 18,
				"lte": 30,
			},
		},
	}

	if !reflect.DeepEqual(q, expected) {
		t.Errorf("Expected %v, got %v", expected, q)
	}
}

func TestBuilder_Sort(t *testing.T) {
	// Test simple string sort
	b := NewBuilder()
	b.Sort("created_at", "desc")
	q := b.Build()

	expectedSort := []map[string]interface{}{
		{"created_at": map[string]interface{}{"order": "desc"}},
	}

	if sort, ok := q["sort"].([]map[string]interface{}); !ok || !reflect.DeepEqual(sort, expectedSort) {
		t.Errorf("Expected sort %v, got %v", expectedSort, q["sort"])
	}

	// Test complex map sort
	b2 := NewBuilder()
	complexSort := map[string]interface{}{
		"location": "test_loc",
		"order":    "asc",
		"unit":     "km",
	}
	b2.Sort("_geo_distance", complexSort)
	q2 := b2.Build()

	expectedSort2 := []map[string]interface{}{
		{"_geo_distance": complexSort},
	}

	if sort, ok := q2["sort"].([]map[string]interface{}); !ok || !reflect.DeepEqual(sort, expectedSort2) {
		t.Errorf("Expected complex sort %v, got %v", expectedSort2, q2["sort"])
	}
}

func TestBoolBuilder(t *testing.T) {
	bb := NewBoolBuilder()
	bb.Must(map[string]interface{}{"term": map[string]interface{}{"field1": "value1"}})
	bb.Filter(map[string]interface{}{"term": map[string]interface{}{"field2": "value2"}})

	q := bb.Build()

	boolMap := q["bool"].(map[string]interface{})
	if _, ok := boolMap["must"]; !ok {
		t.Error("Expected must clause")
	}
	if _, ok := boolMap["filter"]; !ok {
		t.Error("Expected filter clause")
	}
}
