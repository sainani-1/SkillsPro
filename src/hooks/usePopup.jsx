import { useCallback, useMemo, useState } from 'react';
import Toast from '../components/Toast';

const usePopup = () => {
  const [popup, setPopup] = useState({ open: false, title: '', message: '', type: 'info' });

  const openPopup = useCallback((title, message, type = 'info') => {
    setPopup({ open: true, title, message, type });
  }, []);

  const closePopup = useCallback(() => {
    setPopup((prev) => ({ ...prev, open: false }));
  }, []);

  const popupNode = useMemo(
    () => (
      <Toast
        show={popup.open}
        message={`${popup.title ? `${popup.title}: ` : ''}${popup.message}`}
        type={popup.type}
        duration={3000}
        onClose={closePopup}
      />
    ),
    [popup, closePopup]
  );

  return { popup, openPopup, closePopup, popupNode };
};

export default usePopup;
