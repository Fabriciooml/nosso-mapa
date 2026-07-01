export type PlaceStatus = 'to_go' | 'gone' | 'repeat'

export interface Category {
  id: number
  name: string
}

export interface Place {
  id: number
  name: string
  google_place_id: string | null
  lat: number
  lng: number
  status: PlaceStatus
  avg_rating: number | null
  categories: Category[]
  created_at: string
}

export interface PlaceCreate {
  name: string
  google_place_id: string | null
  lat: number
  lng: number
  category_ids: number[]
}

export interface ReviewCreate {
  reviewer: string
  rating: number
}
