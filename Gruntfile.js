module.exports = function (grunt) {
    'use strict';

    // load all grunt tasks matching the `grunt-*` pattern
    require('load-grunt-tasks')(grunt);

    var BANNER = '/*! v<%= pkg.version %> — ' +
            '<%= grunt.template.today("yyyy-mm-dd") %> */' +
            '\n\n';

    var config = {};

    config.pkg = grunt.file.readJSON('package.json');

    config.concat = {
        options: {
          stripBanners: true,
          banner: BANNER
        },
        task: {
          src: ['src/nb.js', 'src/ecma-5.js', 'src/nb.common.js', 'src/nb.node.js', 'src/nb.blocks.js'],
          dest: '<%= pkg.name %>.js',
        }
    };

    config.uglify = {
      options: {
        banner: BANNER,
        compress: {
          drop_console: true
        },
        wrap: 'nb'
      },
      task: {
        src: ['<%= pkg.name %>.js'],
        dest: '<%= pkg.name %>.min.js'
      }
    };

    config.mochaTest = {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['tests/*.js']
      }
    };

    grunt.initConfig(config);

    grunt.registerTask('build:dev', ['concat']);
    grunt.registerTask('build:prod', ['concat', 'uglify']);
    grunt.registerTask('tests', ['mochaTest']);
};
