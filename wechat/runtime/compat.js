'use strict';
// Older device JS engines may lack this ES2022 helper used by the shared core.
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (object, key) => Object.prototype.hasOwnProperty.call(object, key),
    configurable: true, writable: true
  });
}
