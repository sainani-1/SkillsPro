const DEVTOOLS_THRESHOLD = 160;
const ZOOM_TOLERANCE = 0.08;

const getViewportZoom = () => {
  if (typeof window === 'undefined') return 1;
  const viewportScale = Number(window.visualViewport?.scale);
  if (Number.isFinite(viewportScale) && viewportScale > 0) {
    return viewportScale;
  }
  return 1;
};

export const isLikelyDevToolsOpen = () => {
  if (typeof window === 'undefined') return false;

  const zoom = getViewportZoom();
  if (Math.abs(zoom - 1) > ZOOM_TOLERANCE) {
    return false;
  }

  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;
  return widthGap > DEVTOOLS_THRESHOLD || heightGap > DEVTOOLS_THRESHOLD;
};

