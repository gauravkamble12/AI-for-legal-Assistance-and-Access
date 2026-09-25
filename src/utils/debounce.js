export const debounce = (callback, delay) => {
  let timer = null;

  const debounced = (...args) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      callback(...args);
    }, delay);
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return debounced;
};
