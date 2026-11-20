// Trace settings, fixed for every upload (the adjust sliders were removed).
// Values were tuned on the RCBC jersey: Medium detail cut its shapes from
// about 1,100 to about 600 while names, numbers and patterns stay sharp.

export const DEFAULT_ADJUST = {
  colors: 6,            // 2 to 12
  detail: 'medium',     // 'low' | 'medium' | 'high'
  smoothness: 'medium', // 'low' | 'medium' | 'high'
  specks: 4,            // px, 0 to 16
};

export const LEVELS = ['low', 'medium', 'high'];

// Detail = how much the cleanup filter (cleanup.js) merges small bits.
const DETAIL = {
  low: { radius: 2, passes: 2 },
  medium: { radius: 2, passes: 1 },
  high: null, // no cleanup: keeps every thin line and small letter
};

// Smoothness = how VTracer fits curves (option names from its README).
const SMOOTHNESS = {
  low: { cornerThreshold: 45, lengthThreshold: 3.5, spliceThreshold: 45 },
  medium: { cornerThreshold: 60, lengthThreshold: 4, spliceThreshold: 45 },
  high: { cornerThreshold: 90, lengthThreshold: 6, spliceThreshold: 60 },
};

export const DEFAULT_TRACE_SETTINGS = {
  // Remove the plain background around the design (see removeBackground.js).
  removeBackground: true,
  // 'ai': BiRefNet model finds the design (works on busy backgrounds).
  // 'color': plain-color method (removeBackground.js), no AI.
  backgroundMethod: 'ai',
};

export function buildTraceSettings(adjust, removeBackground, scale = 1) {
  return {
    // Colors are reduced by our own palette step (see quantize.js), not by
    // VTracer's maxColors option, which merged unrelated colors in testing.
    colors: adjust.colors,
    removeBackground,
    cleanup: DETAIL[adjust.detail],
    vtracer: {
      clustering: 'color-cluster',
      // 'cutout': shapes never overlap (each has its own holes), so moving
      // shapes between layers or removing shading never uncovers anything.
      hierarchical: 'cutout',
      mode: 'spline',          // smooth curves
      filterSpeckle: adjust.specks * scale, // specks are measured on the original image
      ...SMOOTHNESS[adjust.smoothness],
    },
  };
}
