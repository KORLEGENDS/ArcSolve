/*
    This function merges multiple refs into a single ref callback.
    It ensures that the value is assigned to each ref, whether it's a function or a ref object.
    This is useful when you need to merge external refs with an internal ref.
*/

export function mergeButtonRefs<T extends HTMLButtonElement>(
  refs: React.Ref<T>[]
): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref != null && typeof ref === 'object' && 'current' in ref) {
        (ref as React.RefObject<T | null>).current = value;
      }
    }
  };
}
