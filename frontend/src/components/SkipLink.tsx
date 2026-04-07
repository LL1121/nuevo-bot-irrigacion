// Skip to main content link for keyboard users
import { useEffect } from 'react';

export const SkipLink = () => {
  useEffect(() => {
    const skipLink = document.getElementById('skip-link');
    const mainContent = document.getElementById('main-content');

    if (skipLink && mainContent) {
      const handleClick = (e: Event) => {
        e.preventDefault();
        mainContent.focus();
        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      skipLink.addEventListener('click', handleClick);
      return () => skipLink.removeEventListener('click', handleClick);
    }
  }, []);

  return (
    <a
      id="skip-link"
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
};

export default SkipLink;
