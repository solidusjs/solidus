module.exports = function( grunt ){

	var pkg = grunt.file.readJSON( __dirname +'/package.json');

	grunt.initConfig({
		pkg: pkg,
		concat: {
			js: {
				options: {
					separator: ';'
				},
				src: ['assets/scripts/**/*.js'],
				dest: 'assets/compiled/scripts.js'
			},
			css: {
				options: {
					separator: '\n'
				},
				src: ['assets/styles/**/*.css','assets/styles/**/*.scss','assets/styles/**/*.sass'],
				dest: 'assets/compiled/styles.scss'
			}
		},
		sass: {
			dev: {
				options: {
					lineNumbers: true,
					style: 'expanded'
				},
				files: {
					'assets/compiled/styles_tmp.css': ['assets/compiled/styles.scss']
				}
			}
		},
		// copy final css over after the fact because sass deletes-compiles-replaces
		// which causes FoUC in conjunction with livereload
		copy: {
			css: {
				src: 'assets/compiled/styles_tmp.css',
				dest: 'assets/compiled/styles.css'
			}
		},
		handlebars: {
			compile: {
				options: {
					namespace: 'solidus.templates',
					processName: function( template_path ){
						return template_path.replace( /(^views\/)|(\.hbs)/ig, '' );
					}
				},
				files: {
					'assets/compiled/templates.js': ['views/**/*.hbs']
				}
			},
			partials: {
				options: {
					namespace: 'solidus.partials',
					partialRegex: /.*/,
					partialsUseNamespace: true,
					processPartialName: function( partial_path ){
						return partial_path.replace( /(^views\/)|(\.hbs)/ig, '' );
					}
				},
				files: {
					'assets/compiled/partials.js': ['views/**/*.hbs']
				}
			}
		},
		regarde: {
			styles: {
				files: ['assets/styles/**/*.scss','assets/styles/**/*.css','assets/styles/**/*.sass'],
				tasks: ['compilecss']
			},
			templates: {
				files: ['views/**/*.hbs'],
				tasks: ['compilehbs']
			},
			scripts: {
				files: ['assets/scripts/**/*.js'],
				tasks: ['compilejs']
			},
			reload: {
				files: ['assets/compiled/styles.css'],
				tasks: ['livereload']
			}
		},
		clean: {
			sass: ['assets/compiled/styles.scss','assets/compiled/styles_tmp.css'],
		}
	});
	
	// The cool way to load Grunt tasks
	// https://github.com/Fauntleroy/relay.js/blob/master/Gruntfile.js
	Object.keys( pkg.devDependencies ).forEach( function( dep ){
		if( dep.substring( 0, 6 ) === 'grunt-' ) grunt.loadNpmTasks( dep );
	});

	grunt.registerTask( 'server', 'Start the Solidus server', function(){
		var port = grunt.option('port') || grunt.option('p');
		var args = ['start'];
		if( port ) args = args.concat([ '-p', port ]);
		grunt.util.spawn({
			cmd: 'solidus',
			args: args,
			opts: {
				stdio: 'inherit'
			}
		});
	});

	grunt.registerTask( 'default', ['compile'] );
	grunt.registerTask( 'compile', ['compilecss','compilehbs','compilejs'] );
	grunt.registerTask( 'compilehbs', ['handlebars'] );
	grunt.registerTask( 'compilejs', ['concat:js'] );
	grunt.registerTask( 'compilecss', ['concat:css','sass','copy','clean:sass'] );
	grunt.registerTask( 'dev', ['compile','livereload-start','server','regarde' ] );

	process.chdir( grunt.solidus_cwd );

};