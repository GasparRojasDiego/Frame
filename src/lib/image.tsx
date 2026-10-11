// Sustituto ligero de next/image para escritorio: un <img> nativo.
// El pipeline de optimización de Next es innecesario en una app local
// (las imágenes ya viven en memoria o en IndexedDB como data URIs).
import * as React from 'react';

export interface ImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  /** Compatibilidad con la API legacy de next/image. */
  layout?: 'fill' | 'fixed' | 'intrinsic' | 'responsive';
  objectFit?: React.CSSProperties['objectFit'];
  'data-ai-hint'?: string;
}

const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ fill, priority, unoptimized, layout, objectFit, style, ...props }, ref) => {
    const isFill = fill || layout === 'fill';
    const fillStyle: React.CSSProperties | undefined = isFill
      ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: objectFit ?? 'cover' }
      : objectFit
        ? { objectFit }
        : undefined;
    return (
      <img
        ref={ref}
        loading={priority ? 'eager' : props.loading}
        style={fillStyle ? { ...fillStyle, ...style } : style}
        {...props}
      />
    );
  }
);
Image.displayName = 'Image';
export default Image;
