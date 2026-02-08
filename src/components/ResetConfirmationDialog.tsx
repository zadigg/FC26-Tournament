import { useState } from 'react'
import { reverseGeocode } from '../lib/geocoding'

interface ResetConfirmationDialogProps {
  isOpen: boolean
  onConfirm: (cityName: string) => void
  onCancel: () => void
}

export function ResetConfirmationDialog({ isOpen, onConfirm, onCancel }: ResetConfirmationDialogProps) {
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsRequestingLocation(true)
    setLocationError(null)
    setLocationDenied(false)

    try {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser')
      }

      // Request location permission
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: false, // Use less strict accuracy for better compatibility
            timeout: 5000, // Shorter timeout
            maximumAge: 60000, // Accept cached location up to 1 minute old
          }
        )
      })

      const { latitude, longitude } = position.coords
      
      // Reverse geocode to get city name
      const cityName = await reverseGeocode(latitude, longitude)
      
      if (cityName) {
        onConfirm(cityName)
      } else {
        // If geocoding fails, don't allow reset
        setLocationDenied(true)
        setLocationError('Could not determine city name. Reset cannot proceed without location information.')
        setIsRequestingLocation(false)
      }
    } catch (error) {
      console.error('Failed to get location:', error)
      
      // Check if it's a permission denied error
      if (error instanceof GeolocationPositionError) {
        if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
          setLocationDenied(true)
          setLocationError('Location permission denied. Reset cannot proceed without location access. Please allow location access in your browser settings.')
        } else if (error.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
          setLocationDenied(true)
          setLocationError('Location unavailable. Reset cannot proceed without location access. Please ensure location services are enabled.')
        } else if (error.code === GeolocationPositionError.TIMEOUT) {
          setLocationDenied(true)
          setLocationError('Location request timed out. Reset cannot proceed without location access. Please try again.')
        } else {
          setLocationDenied(true)
          setLocationError('Could not get location. Reset cannot proceed without location access.')
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Failed to get location'
        setLocationDenied(true)
        setLocationError(`${errorMessage}. Reset cannot proceed without location access.`)
      }
      setIsRequestingLocation(false)
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-red-600/50 bg-slate-800 p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-red-400">⚠️ Reset Tournament</h2>
        <p className="mb-4 text-slate-300">
          Are you sure you want to reset the tournament? This will:
        </p>
        <ul className="mb-4 ml-6 list-disc space-y-1 text-sm text-slate-400">
          <li>Delete all players</li>
          <li>Delete all matches</li>
          <li>Clear all tournament data</li>
          <li>This action cannot be undone</li>
        </ul>
        <p className="mb-4 text-sm text-red-400">
          ⚠️ Location sharing is REQUIRED to reset the tournament. This helps track who performed the reset. Reset cannot proceed without location access.
        </p>
        {locationError && (
          <div className="mb-4 rounded border border-red-600/50 bg-red-900/50 p-3 text-sm text-red-300">
            {locationError}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {locationDenied ? (
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded bg-slate-600 px-4 py-2 font-medium text-slate-200 hover:bg-slate-500"
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isRequestingLocation}
                className="flex-1 rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRequestingLocation ? 'Getting location...' : 'Yes, Reset Tournament'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isRequestingLocation}
                className="flex-1 rounded bg-slate-600 px-4 py-2 font-medium text-slate-200 hover:bg-slate-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
