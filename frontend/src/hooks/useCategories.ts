import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

const CATEGORIES_KEY = ['categories'] as const

export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: api.categories.list,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.categories.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  })
}
