const DEVTOOLS_WIDTH_THRESHOLD = 260;
const DEVTOOLS_HEIGHT_THRESHOLD = 320;
const ZOOM_TOLERANCE = 0.08;

const getViewportZoom = () => {
  if (typeof window === 'undefined') return 1;
  const viewportScale = Number(window.visualViewport?.scale);
  if (Number.isFinite(viewportScale) && viewportScale > 0) {
    return viewportScale;
  }
  return 1;
};

export const hasDevToolsSizeSignal = () => {
  if (typeof window === 'undefined') return false;

  const zoom = getViewportZoom();
  if (Math.abs(zoom - 1) > ZOOM_TOLERANCE) {
    return false;
  }

  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;
  const widthLooksLikeDockedDevTools =
    widthGap > DEVTOOLS_WIDTH_THRESHOLD && window.innerWidth < window.outerWidth * 0.85;
  const heightLooksLikeDockedDevTools =
    heightGap > DEVTOOLS_HEIGHT_THRESHOLD && window.innerHeight < window.outerHeight * 0.75;

  return widthLooksLikeDockedDevTools || heightLooksLikeDockedDevTools;
};

export const isLikelyDevToolsOpen = hasDevToolsSizeSignal;
export const isDeveloperToolsDetected = isLikelyDevToolsOpen;
