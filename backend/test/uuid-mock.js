// A CommonJS mock for uuid to bypass Jest's ES module parsing issues in node_modules
module.exports = {
  v4: () => 'mocked-uuid-v4-' + Math.random().toString(36).substring(2, 9),
  MAX: '00000000-0000-0000-0000-000000000000',
  validate: () => true
};
