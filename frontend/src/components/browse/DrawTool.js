import { useCallback, useEffect, useRef, useState } from 'react';
import { DrawingManagerF, useGoogleMap } from '@react-google-maps/api';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// "Draw" tool — toggles google.maps.drawing.DrawingManager into POLYGON mode
// then serialises the drawn vertices into the `polygon` URL param. The
// drawn polyline is kept on the map so the user can see the active filter.
export default function DrawTool({ polygonString, onPolygonChange }) {
  const map = useGoogleMap();
  const [isDrawing, setIsDrawing] = useState(false);
  const drawnRef = useRef(null);

  const clearShape = useCallback(() => {
    if (drawnRef.current) {
      drawnRef.current.setMap(null);
      drawnRef.current = null;
    }
  }, []);

  // If the URL polygon was cleared externally (e.g. user hit "Reset"), drop
  // any rendered shape we might still be holding on to.
  useEffect(() => {
    if (!polygonString) clearShape();
  }, [polygonString, clearShape]);

  // If the URL polygon arrives without us having drawn it (e.g. shared link),
  // render it onto the map so the user sees what they're filtering by.
  useEffect(() => {
    if (!map || !polygonString || drawnRef.current) return;
    const path = polygonString
      .split(';')
      .map((p) => {
        const [lng, lat] = p.split(',').map(Number);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return { lat, lng };
      })
      .filter(Boolean);
    if (path.length < 3) return;
    const poly = new window.google.maps.Polygon({
      paths: path,
      strokeColor: '#f97316',
      strokeWeight: 2,
      fillColor: '#f97316',
      fillOpacity: 0.15,
      clickable: false,
      editable: false,
    });
    poly.setMap(map);
    drawnRef.current = poly;
  }, [map, polygonString]);

  const handlePolygonComplete = useCallback(
    (polygon) => {
      clearShape();
      drawnRef.current = polygon;
      polygon.setOptions({
        strokeColor: '#f97316',
        strokeWeight: 2,
        fillColor: '#f97316',
        fillOpacity: 0.15,
        clickable: false,
        editable: false,
      });
      const path = polygon
        .getPath()
        .getArray()
        .map((p) => `${p.lng()},${p.lat()}`);
      onPolygonChange?.(path.join(';'));
      setIsDrawing(false);
    },
    [clearShape, onPolygonChange],
  );

  const drawingOptions = {
    drawingControl: false,
    drawingMode: isDrawing ? window.google?.maps?.drawing?.OverlayType?.POLYGON : null,
    polygonOptions: {
      strokeColor: '#f97316',
      strokeWeight: 2,
      fillColor: '#f97316',
      fillOpacity: 0.15,
      clickable: false,
      editable: false,
    },
  };

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
      <Button
        type="button"
        variant={isDrawing ? 'default' : 'secondary'}
        size="sm"
        onClick={() => setIsDrawing((d) => !d)}
        className="shadow-md"
      >
        <Pencil className="mr-1.5 h-4 w-4" />
        {isDrawing ? 'Cancel' : 'Draw area'}
      </Button>
      {polygonString && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            clearShape();
            onPolygonChange?.('');
          }}
          className="shadow-md"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Clear shape
        </Button>
      )}
      <DrawingManagerF
        options={drawingOptions}
        onPolygonComplete={handlePolygonComplete}
      />
    </div>
  );
}
