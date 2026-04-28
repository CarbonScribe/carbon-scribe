'use client'

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { mockCorporateData, mockCredits, mockProjects, mockRetirements, mockPortfolio } from '@/lib/mockData'
import { useCompliance } from '@/hooks/useCompliance'
import { ComplianceReport, ComplianceStatusItem, ComplianceFramework } from '@/types'

interface CorporateContextType {
  company: any
  credits: any[]
  projects: any[]
  retirements: any[]
  portfolio: any
  selectedCredit: any | null
  setSelectedCredit: (credit: any) => void
  addToCart: (credit: any) => void
  cart: any[]
  removeFromCart: (creditId: string) => void
  clearCart: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  // Compliance-related
  complianceReport: ComplianceReport | null
  complianceStatuses: ComplianceStatusItem[] | null
  complianceLoading: boolean
  complianceError: string | null
  fetchComplianceReport: (entityId: string) => Promise<void>
  fetchComplianceStatuses: () => Promise<void>
  triggerComplianceCheck: (framework: ComplianceFramework, entityId: string) => Promise<void>
}

const CorporateContext = createContext<CorporateContextType | undefined>(undefined)

export function CorporateProvider({ children }: { children: ReactNode }) {
  const [company] = useState(mockCorporateData)
  const [credits] = useState(mockCredits)
  const [projects] = useState(mockProjects)
  const [retirements] = useState(mockRetirements)
  const [portfolio] = useState(mockPortfolio)
  const [selectedCredit, setSelectedCredit] = useState<any>(null)
  const [cart, setCart] = useState<any[]>([])
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  
  // Compliance state
  const compliance = useCompliance()
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null)
  const [complianceStatuses, setComplianceStatuses] = useState<ComplianceStatusItem[] | null>(null)

  // Load initial compliance data on mount
  useEffect(() => {
    // Optionally fetch initial compliance data
    // In production, you might want to fetch this
    // For now, we'll let components fetch as needed
  }, [])

  const addToCart = (credit: any) => {
    setCart(prev => [...prev, credit])
  }

  const removeFromCart = (creditId: string) => {
    setCart(prev => prev.filter(item => item.id !== creditId))
  }

  const clearCart = () => {
    setCart([])
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const fetchComplianceReport = async (entityId: string) => {
    await compliance.getComplianceReport(entityId)
    setComplianceReport(compliance.report)
  }

  const fetchComplianceStatuses = async () => {
    await compliance.getAllStatuses()
    setComplianceStatuses(compliance.statuses)
  }

  const triggerComplianceCheck = async (framework: ComplianceFramework, entityId: string) => {
    await compliance.checkCompliance({
      framework,
      entityType: 'COMPANY',
      entityId,
    })
  }

  return (
    <CorporateContext.Provider value={{
      company,
      credits,
      projects,
      retirements,
      portfolio,
      selectedCredit,
      setSelectedCredit,
      addToCart,
      cart,
      removeFromCart,
      clearCart,
      theme,
      toggleTheme,
      // Compliance
      complianceReport,
      complianceStatuses,
      complianceLoading: compliance.loading,
      complianceError: compliance.error,
      fetchComplianceReport,
      fetchComplianceStatuses,
      triggerComplianceCheck,
    }}>
      {children}
    </CorporateContext.Provider>
  )
}

export const useCorporate = () => {
  const context = useContext(CorporateContext)
  if (!context) {
    throw new Error('useCorporate must be used within CorporateProvider')
  }
  return context
}