/**
 * Attribute added by default to every highlight.
 * @type {string}
 */
export const DATA_ATTR = 'data-highlighted';

/**
 * Attribute used to group highlight wrappers.
 * @type {string}
 */
export const TIMESTAMP_ATTR = 'data-timestamp';

export const NODE_TYPE = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3
};

/**
 * Don't highlight content of these tags.
 * @type {string[]}
 */
export const IGNORE_TAGS = [
  'SCRIPT',
  'STYLE',
  'SELECT',
  'OPTION',
  'BUTTON',
  'OBJECT',
  'APPLET',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'EMBED',
  'PARAM',
  'METER',
  'PROGRESS'
];
