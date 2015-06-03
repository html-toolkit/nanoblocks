module.exports = function (grunt) {
    'use strict';

    // load all grunt tasks matching the `grunt-*` pattern
    require('load-grunt-tasks')(grunt);

    var BANNER = '/*! v<%= pkg.version %> — ' +
            '<%= grunt.template.today("yyyy-mm-dd") %> */' +
            '\n\n';

    var config = {};

    config.pkg = grunt.file.readJSON('package.json');

    config.browserify = {
        options: {
          banner: BANNER
        },
        task: {
          src: ['src/index.js'],
          dest: '<%= pkg.name %>.js',
        }
    };

    config.uglify = {
      options: {
        banner: BANNER,
        compress: {
          drop_console: true
        }
      },
      task: {
        src: ['<%= pkg.name %>.js'],
        dest: '<%= pkg.name %>.min.js'
      }
    };

    grunt.initConfig(config);

    grunt.registerTask('build:dev', ['browserify']);
    grunt.registerTask('build:prod', ['browserify', 'uglify']);
    grunt.registerTask('tests', ['mochaTest']);
};
