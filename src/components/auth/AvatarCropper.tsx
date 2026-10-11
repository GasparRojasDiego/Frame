import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AvatarCropperProps {
  imageSrc: string | null;
  onClose: () => void;
  onSave: (croppedImage: string) => void;
}

const AvatarCropper = ({ imageSrc, onClose, onSave }: AvatarCropperProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Reset state when a new image is loaded
  useEffect(() => {
    if (imageSrc) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [imageSrc]);

  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  // Add wheel event handler for zooming
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.005; // Adjust sensitivity
    setZoom(prevZoom => {
      const newZoom = prevZoom + zoomDelta;
      return Math.max(1, Math.min(newZoom, 3)); // Clamp between 1 and 3
    });
  };
  
  const handleSave = () => {
    if (!imageSrc || !imageRef.current) return;

    const image = imageRef.current;
    const canvas = document.createElement('canvas');
    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // The scale of the image to fit within the container while maintaining aspect ratio
    const scale = Math.min(
      image.width / image.naturalWidth,
      image.height / image.naturalHeight
    );
    
    // The dimensions of the source image to be cropped
    const cropSizeInSource = outputSize / (scale * zoom);
    
    // The source x and y, considering the pan and zoom
    const sx = (image.naturalWidth - cropSizeInSource) / 2 - (position.x / (scale * zoom));
    const sy = (image.naturalHeight - cropSizeInSource) / 2 - (position.y / (scale * zoom));
    
    ctx.drawImage(
      image, 
      sx, sy, cropSizeInSource, cropSizeInSource, // Source rectangle
      0, 0, outputSize, outputSize // Destination rectangle
    );
      
    const croppedDataUrl = canvas.toDataURL('image/png');
    onSave(croppedDataUrl);
  };

  const clampPosition = useCallback((pos: {x: number, y: number}) => {
    if (!imageRef.current || !containerRef.current) return pos;

    const image = imageRef.current;
    const container = containerRef.current;

    const imageAspectRatio = image.naturalWidth / image.naturalHeight;
    const containerAspectRatio = container.clientWidth / container.clientHeight;

    let renderedWidth, renderedHeight;
    if (imageAspectRatio > containerAspectRatio) {
      renderedWidth = container.clientWidth;
      renderedHeight = container.clientWidth / imageAspectRatio;
    } else {
      renderedHeight = container.clientHeight;
      renderedWidth = container.clientHeight * imageAspectRatio;
    }

    const maxPanX = Math.max(0, (renderedWidth * zoom - container.clientWidth) / 2);
    const maxPanY = Math.max(0, (renderedHeight * zoom - container.clientHeight) / 2);

    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, pos.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, pos.y)),
    };
  }, [zoom]);
  
  useEffect(() => {
    setPosition(clampPosition(position));
  }, [zoom, clampPosition]);


  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      initialX: position.x,
      initialY: position.y,
    };
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    const newPos = {
      x: dragStartRef.current.initialX + deltaX,
      y: dragStartRef.current.initialY + deltaY,
    };
    setPosition(clampPosition(newPos));
  }, [clampPosition]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.touches[0].clientX - dragStartRef.current.startX;
    const deltaY = e.touches[0].clientY - dragStartRef.current.startY;
    const newPos = {
      x: dragStartRef.current.initialX + deltaX,
      y: dragStartRef.current.initialY + deltaY,
    };
    setPosition(clampPosition(newPos));
  }, [clampPosition]);

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Encuadrar la foto</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div
            ref={containerRef}
            className="relative w-64 h-64 mx-auto overflow-hidden cursor-grab"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onWheel={handleWheel}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Avatar para recortar"
              className="absolute top-1/2 left-1/2 max-w-full max-h-full"
              style={{
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transition: 'transform 0.1s ease-out',
                userSelect: 'none',
              }}
              draggable="false"
            />
            <div 
              className="absolute inset-0 rounded-full pointer-events-none" 
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} 
            />
          </div>
          <div className="flex items-center gap-4 px-4">
            <Slider
              min={1}
              max={3}
              step={0.1}
              value={[zoom]}
              onValueChange={handleZoomChange}
              className="flex-grow"
            />
            <Button
              onClick={handleSave}
              variant="outline"
              className="border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
            >
              Aceptar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropper;
