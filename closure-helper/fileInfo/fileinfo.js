var fs = require('fs');

var FileInfo = function(filePath, nsDeps) {
  this.nsDeps = nsDeps;
  this.path = filePath;
  this.ns = null;
  this.otherNs = [];

  this.readFile(filePath);
};
module.exports = FileInfo;

FileInfo.prototype.readFile = function(filePath) {
  var data = new String(fs.readFileSync(filePath));

  var nssPattern = /goog\.provide\(['"].+?['"]\)/g;
  var nsPattern = /goog\.provide\(['"](.+?)['"]\)/;
  var matches = data.match(nssPattern);
  if (matches) {
    matches.forEach(function(str) {
      var matches = str.match(nsPattern);
      if (this.ns === null) {
        this.ns = matches[1];
      } else {
        this.otherNs.push(matches[1]);
      }

      if (this.nsDeps) {
        this.nsDeps.add(matches[1]);
      }
    }, this);
}
};
