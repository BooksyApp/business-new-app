import { API_BASE_URL } from '@/config/api';
import { useEffect, useRef, useState } from 'react';
import { useMarket } from '@/services/platformService';
import { pinOutsideMarket } from '@/lib/marketBounds';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';

// #56: see the TileLayer below. Set VITE_MAP_TILE_URL / VITE_MAP_TILE_ATTRIBUTION to move
// off the OSM public tile servers without touching this file.
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t } from "@/i18n";

// Fix for default marker icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icon for selected location (red)
const selectedLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to pan map to position without changing zoom
function MapPan({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      // Only pan to center, never change zoom
      map.panTo(center, { animate: true });
    }
  }, [center, map]);
  return null;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
      onMapClick(newPos[0], newPos[1]);
    },
  });
  return null;
}

interface AddressMapPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string, buildingNumber?: string) => void;
  initialPosition?: [number, number] | null;
  selectedPosition?: [number, number] | null;
  disabled?: boolean;
  /** The business's country (ISO code) when known; picks the map centre. */
  country?: string | null;
}

export default function AddressMapPicker({ 
  onLocationSelect, 
  initialPosition = null,
  selectedPosition = null,
  disabled = false,
  country = null
}: AddressMapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(initialPosition || selectedPosition);
  // No hardcoded city: until a position is known the map opens on the market's own centre
  // (Baku for AZ), taken from the platform's country rows.
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(initialPosition || selectedPosition);
  const [zoom, setZoom] = useState(15);
  const market = useMarket(country);
  const located = useRef(Boolean(initialPosition || selectedPosition));
  // LR-15: a pin outside the salon's country is not passed on (so it cannot be saved);
  // the marker stays at the last good spot and a warning says why.
  const [outside, setOutside] = useState(false);
  const marketRef = useRef(market);
  marketRef.current = market;

  useEffect(() => {
    if (market && !located.current) {
      setMapCenter([market.center.lat, market.center.lng]);
      setZoom(market.center.zoom);
    }
  }, [market]);

  useEffect(() => {
    // Request user location when component mounts
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          located.current = true;
          setMapCenter(userPos);
          setZoom(15);
          
          // If no position is set yet, use user location as default — unless the device is
          // abroad: an owner registering from another country must not get that pin (LR-15).
          if (!position && !initialPosition && !selectedPosition
              && !pinOutsideMarket(marketRef.current?.country, userPos[0], userPos[1])) {
            setPosition(userPos);
            onLocationSelect(userPos[0], userPos[1], '');
          }
        },
        (err) => {
          // Handle different geolocation error types
          let errorMessage = t("addressMapPicker.locationAccessDeniedOrUnavailable");
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = t("addressMapPicker.locationPermissionDeniedByUser");
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = t("addressMapPicker.locationInformationUnavailable");
              break;
            case err.TIMEOUT:
              errorMessage = t("addressMapPicker.locationRequestTimedOut");
              break;
            default:
              errorMessage = t("addressMapPicker.locationError", { value: err.message || t("addressMapPicker.unknownError") });
              break;
          }
          // Only log non-critical errors (don't spam console with expected permission denials)
          if (err.code !== err.PERMISSION_DENIED) {
            console.warn('Geolocation error:', errorMessage, err);
          }
          // No fix: the market-centre effect above keeps the map on the business's country.
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000, 
          maximumAge: 60000 // Cache location for 1 minute to avoid repeated requests
        }
      );
    } else {
      // Geolocation not supported
      console.warn('Geolocation is not supported by this browser');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ask for the location once, on open
  }, []);

  // Update position if initialPosition or selectedPosition changes (from external sources like search)
  useEffect(() => {
    if (selectedPosition) {
      located.current = true;
      setPosition(selectedPosition);
      // Only update mapCenter for external selections, which will trigger a pan (not zoom change)
      setMapCenter(selectedPosition);
    } else if (initialPosition && !position) {
      located.current = true;
      setPosition(initialPosition);
      setMapCenter(initialPosition);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only outside changes move the pin; adding position would snap a dragged pin back
  }, [initialPosition, selectedPosition]);

  const handlePositionChange = async (lat: number, lng: number) => {
    const newPos: [number, number] = [lat, lng];
    const previous = position;
    setPosition(newPos);
    const reject = () => {
      setOutside(true);
      setPosition(previous);
    };
    // Don't update mapCenter when user clicks - this prevents zoom reset
    // The marker will move to the new position without changing zoom
    
    // Reverse geocode to get address
    try {
      const response = await fetch(
        // #56: proxied through the backend for the same reason as the forward lookup —
        // the User-Agent set here never left the browser (forbidden header), so OSM never
        // received the identification its policy requires. See GeocodeService.
        `${API_BASE_URL}/public/geocode/reverse?lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      if (pinOutsideMarket(marketRef.current?.country, lat, lng, data.address?.country_code)) {
        reject();
        return;
      }
      setOutside(false);
      const address = data.display_name || '';
      // Extract building number from address details
      const buildingNumber = data.address?.house_number || data.address?.building || '';
      onLocationSelect(lat, lng, address, buildingNumber);
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      if (pinOutsideMarket(marketRef.current?.country, lat, lng)) {
        reject();
        return;
      }
      setOutside(false);
      onLocationSelect(lat, lng, '', '');
    }
  };

  return (
    <div className="w-full">
      <div className={`w-full h-96 rounded-xl overflow-hidden border-2 border-gray-200 relative ${disabled ? 'opacity-50' : ''}`}>
        {mapCenter ? (<MapContainer
          center={mapCenter}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={!disabled}
          dragging={!disabled}
          doubleClickZoom={!disabled}
          touchZoom={!disabled}
        >
          {/* #56: OSM's public tile servers exclude products like this, so the provider
              has to change. Making the URL and attribution configuration means that swap
              is an env change, not a code change and a release. The OSM values stay the
              default so nothing breaks before the new provider is chosen. */}
          <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
          {/* Only pan to center when mapCenter changes (from external selection), never change zoom */}
          <MapPan center={mapCenter} />
          
          {/* Global map click handler - only when not disabled */}
          {!disabled && <MapClickHandler onMapClick={handlePositionChange} />}
          
          {/* Selected location marker */}
          {position && (
            <Marker 
              position={position} 
              icon={selectedLocationIcon}
            />
          )}
        </MapContainer>) : null}
        {/* Disabled overlay - more prominent gray overlay */}
        {disabled && (
          <div className="absolute inset-0 bg-gray-400/60 z-[1000] cursor-not-allowed pointer-events-none" />
        )}
      </div>
      
      {outside && (
        <p role="alert" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          {t("addressMapPicker.pinOutsideCountry")}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-600">
        {disabled ? t("addressMapPicker.pleaseCloseTheBusinessHours") : t("addressMapPicker.clickOnTheMapTo")}
      </p>
    </div>
  );
}

