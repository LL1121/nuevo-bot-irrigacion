/**
 * Image optimization utilities and best practices
 * 
 * Usage:
 * 1. Compress images before adding: use TinyPNG, ImageOptim, or Squoosh
 * 2. Use modern formats with fallbacks (WebP)
 * 3. Use responsive images with srcset
 * 4. Lazy-load images with loading="lazy"
 */

interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  className?: string;
}

/**
 * Optimized image component with lazy loading support
 */
export function OptimizedImage({ 
  src, 
  alt, 
  width, 
  height, 
  lazy = true, 
  className = '' 
}: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      className={className}
      style={{
        // Aspect ratio placeholder to prevent layout shift
        aspectRatio: width && height ? `${width}/${height}` : 'auto'
      }}
    />
  );
}

/**
 * Image with WebP fallback for modern browsers
 */
export function PictureImage({ 
  webpSrc, 
  fallbackSrc, 
  alt, 
  className = '' 
}: { 
  webpSrc: string; 
  fallbackSrc: string; 
  alt: string; 
  className?: string;
}) {
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img 
        src={fallbackSrc} 
        alt={alt} 
        className={className}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}

/**
 * Best practices for image optimization:
 * 
 * 1. Compression:
 *    - PNG: use TinyPNG or OptiPNG
 *    - JPG: use mozjpeg or ImageOptim (quality 75-85)
 *    - SVG: use SVGO to minimize
 * 
 * 2. Formats:
 *    - Use WebP (20-30% smaller) with fallbacks
 *    - Keep PNG for transparency, JPG for photos
 *    - Use SVG for icons/logos
 * 
 * 3. Sizing:
 *    - Export at 2x resolution for retina displays
 *    - Use srcset for responsive images:
 *      srcSet="image-small.jpg 600w, image-large.jpg 1200w"
 * 
 * 4. Loading:
 *    - Use loading="lazy" for below-fold images
 *    - Use loading="eager" for LCP images (above fold)
 *    - Use fetchPriority="high" for critical images (React 19+)
 * 
 * 5. Dimensions:
 *    - Always set width/height to prevent layout shift (CLS)
 *    - Use CSS aspect-ratio or explicit dimensions
 * 
 * 6. CDN Optimization:
 *    - Let CDN optimize images automatically
 *    - Vercel, Netlify, Cloudflare all have image optimization
 */
