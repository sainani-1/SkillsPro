import { useCallback, useMemo, useState } from 'react';
import AlertModal from '../components/AlertModal';

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
      <AlertModal
        show={popup.open}
        title={popup.title}
        message={popup.message}
        type={popup.type}
        onClose={closePopup}
      />
    ),
    [popup, closePopup]
  );

  return { popup, openPopup, closePopup, popupNode };
};

export default usePopup;
