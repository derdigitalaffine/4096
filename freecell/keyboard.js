const TABLE_CONTROL_SELECTOR = '.table button';

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.matches(TABLE_CONTROL_SELECTOR)) return;

  event.preventDefault();
  target.click();
});
