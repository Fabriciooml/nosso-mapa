import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { PlaceCreate, PlaceStatus, PlaceUpdate, ReviewCreate } from '../types'

const PLACES_KEY = ['places'] as const

export function usePlaces() {
  return useQuery({
    queryKey: PLACES_KEY,
    queryFn: api.places.list,
  })
}

export function useCreatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PlaceCreate) => api.places.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useUpdatePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PlaceUpdate }) =>
      api.places.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useDeletePlace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.places.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useUpdateStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: PlaceStatus }) =>
      api.places.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}

export function useAddReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ReviewCreate }) =>
      api.places.addReview(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PLACES_KEY }),
  })
}
