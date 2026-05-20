import { create } from 'zustand'

export interface IpoStore {
  filters: {
    status: string
    recommendation: string
    minScore: number
    sortBy: string
    search: string
  }
  selectedStockId: string | null
  isScanning: boolean
  isSeeded: boolean
  isRefreshingData: boolean
  isManageStocksOpen: boolean

  setFilter: (key: string, value: string | number) => void
  resetFilters: () => void
  setSelectedStockId: (id: string | null) => void
  setIsScanning: (v: boolean) => void
  setIsSeeded: (v: boolean) => void
  setIsRefreshingData: (v: boolean) => void
  setIsManageStocksOpen: (v: boolean) => void
}

const defaultFilters = {
  status: 'ALL',
  recommendation: 'ALL',
  minScore: 0,
  sortBy: 'totalScore',
  search: '',
}

export const useIpoStore = create<IpoStore>((set) => ({
  filters: { ...defaultFilters },
  selectedStockId: null,
  isScanning: false,
  isSeeded: false,
  isRefreshingData: false,
  isManageStocksOpen: false,

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
  setSelectedStockId: (id) => set({ selectedStockId: id }),
  setIsScanning: (v) => set({ isScanning: v }),
  setIsSeeded: (v) => set({ isSeeded: v }),
  setIsRefreshingData: (v) => set({ isRefreshingData: v }),
  setIsManageStocksOpen: (v) => set({ isManageStocksOpen: v }),
}))
