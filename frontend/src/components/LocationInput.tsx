import { useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import type { LocationData } from '../hooks/useLocationPicker';
import './LocationInput.css';

export interface LocationInputProps {
  location: LocationData;
  onTextChange: (text: string) => void;
  onCoordinatesChange: (lat: number, lng: number) => void;
  onGeocode: (text: string) => Promise<void>;
  geocodeError: string | null;
  isGeocoding: boolean;
  disabled: boolean;
  validationError?: string;
}

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

/** Inner component that listens for map click events. */
function MapClickHandler({
  onCoordinatesChange,
  disabled,
}: {
  onCoordinatesChange: (lat: number, lng: number) => void;
  disabled: boolean;
}) {
  useMapEvents({
    click(e) {
      if (!disabled) {
        onCoordinatesChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export function LocationInput({
  location,
  onTextChange,
  onCoordinatesChange,
  onGeocode,
  geocodeError,
  isGeocoding,
  disabled,
  validationError,
}: LocationInputProps) {
  const textInputId = 'location-text-input';
  const errorId = 'location-error';
  const hasCoordinates = location.displayLat !== null && location.displayLng !== null;

  const handleFindOnMap = useCallback(() => {
    if (location.rawLocationText.trim()) {
      onGeocode(location.rawLocationText);
    }
  }, [location.rawLocationText, onGeocode]);

  const mapCenter: [number, number] = hasCoordinates
    ? [location.displayLat!, location.displayLng!]
    : DEFAULT_CENTER;

  const mapZoom = hasCoordinates ? 13 : DEFAULT_ZOOM;

  const showError = geocodeError || validationError;
  const errorMessage = geocodeError ?? validationError ?? undefined;

  return (
    <div className="location-input">
      <div className="location-input__text-group">
        <label className="location-input__label" htmlFor={textInputId}>
          Location (city, state, or address)
        </label>
        <div className="location-input__row">
          <input
            id={textInputId}
            className="location-input__text"
            type="text"
            value={location.rawLocationText}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={disabled}
            aria-describedby={showError ? errorId : undefined}
            aria-invalid={showError ? true : undefined}
          />
          <button
            className="location-input__geocode-btn"
            type="button"
            onClick={handleFindOnMap}
            disabled={disabled || isGeocoding || !location.rawLocationText.trim()}
          >
            {isGeocoding ? 'Searching…' : 'Find on map'}
          </button>
        </div>
      </div>

      {showError && (
        <p id={errorId} className="location-input__error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="location-input__map-wrapper">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom
          className="location-input__map"
          key={hasCoordinates ? `${location.displayLat},${location.displayLng}` : 'default'}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler
            onCoordinatesChange={onCoordinatesChange}
            disabled={disabled}
          />
          {hasCoordinates && (
            <Marker position={[location.displayLat!, location.displayLng!]} />
          )}
        </MapContainer>
      </div>

      {hasCoordinates && (
        <p className="location-input__coords">
          Coordinates: {location.displayLat!.toFixed(4)}, {location.displayLng!.toFixed(4)}
        </p>
      )}
    </div>
  );
}
