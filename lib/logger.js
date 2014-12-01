module.exports = function(options) {
    return {
        info: function(msg) {
            if (options.verbose) {
                console.log(msg)
            }
        }
    }
}
