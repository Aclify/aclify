import gulp from 'gulp'
import babel from 'gulp-babel'
import sourcemaps from 'gulp-sourcemaps'
import path from 'path'
import del from 'del'
import ava from 'gulp-ava'
import gutil from 'gulp-util'

const paths = {
  js: {
    src: 'src/**/*.js',
    dist: 'dist/'
  },
  test: {
    src: 'test/**/*.js',
    dist: 'dist/test/',
    run: 'dist/test/**/*.js'
  },
  config: {
    src: 'src/config/**/*',
    dist: 'dist/config'
  },
  sourceRoot: path.resolve('src')
}

/**
 * @description Compile es6 files to es5 and put them in dist directory
 */
gulp.task('babel:src', ['clean:dist', 'babel:config'], () =>
  gulp.src(paths.js.src)
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.', {sourceRoot: paths.sourceRoot}))
    .pipe(gulp.dest(paths.js.dist))
)

/**
 * @description Compile all es6 files to es5 and put them in dist directory
 */
gulp.task('babel:config', ['config', 'clean:config'], () =>
  gulp.src(`${paths.config.src}.js`)
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.', {sourceRoot: paths.sourceRoot}))
    .pipe(gulp.dest(paths.config.dist))
)

/**
 * @description Compile all es6 files to es5 and put them in dist directories
 */
gulp.task('babel', ['babel:src'])

/**
 * @description Copy config directory to dist directory
 */
gulp.task('config', ['clean:config'], () =>
  gulp.src(`${paths.config.src}.json`)
    .pipe(gulp.dest(paths.config.dist))
)

/**
 * @description Cleans config files
 */
gulp.task('clean:config', () => del(paths.config.dist))

/**
 * @description Cleans dist directory
 */
gulp.task('clean:dist', [], () => del(paths.js.dist))

/**
 * @description Cleans all compiled files
 */
gulp.task('clean', ['clean:dist'])

/**
 * @description Runs unit tests
 */
gulp.task('ava', () =>
  gulp.src([paths.test.run], {read: false})
    .pipe(ava({verbose: true}))
    .on('error', gutil.log)
)

/**
 * @description Watches change in working files
 */
gulp.task('watch', () => gulp.watch(paths.js.src, ['babel:src']))

/**
 * @description Watches change in test folder
 */
gulp.task('watch:ava', () => gulp.watch(paths.test.src, ['ava']))

/**
 * @description Start the development environment
 */
gulp.task('default', ['babel', 'ava'])
