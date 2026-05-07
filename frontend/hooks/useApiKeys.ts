'use client'


import { useState, useEffect, useCallback } from 'react'
import { ApiKeys, loadApiKeys, hasRequiredKeys } from '@/components/ui/ApiKeysModal'


// ========================================
// useApiKeys
// ========================================


interface UseApiKeysReturn {
 keys: Partial<ApiKeys>
 isReady: boolean             
 showModal: boolean
 openModal: () => void
 closeModal: () => void
 handleSave: (keys: ApiKeys) => void
}


export function useApiKeys(): UseApiKeysReturn {
 const [keys, setKeys] = useState<Partial<ApiKeys>>({})
 const [showModal, setShowModal] = useState(false)
 const [mounted, setMounted] = useState(false)


 // SSR
 useEffect(() => {
   setMounted(true)
   setKeys(loadApiKeys())
 }, [])


 useEffect(() => {
   if (mounted && !hasRequiredKeys()) {
     setShowModal(true)
   }
 }, [mounted])


 const openModal = useCallback(() => setShowModal(true), [])
 const closeModal = useCallback(() => setShowModal(false), [])


 const handleSave = useCallback((savedKeys: ApiKeys) => {
   setKeys(savedKeys)
   setShowModal(false)
 }, [])


 const isReady = mounted && !!(
   keys.anthropic_api_key &&
   keys.xai_api_key
 )


 return {
   keys,
   isReady,
   showModal,
   openModal,
   closeModal,
   handleSave,
 }
}

