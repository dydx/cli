import jspm from 'jspm';
import config from 'jspm/lib/config';
import ui from 'jspm/lib/ui';
import { alphabetize } from 'jspm/lib/common';
import fs from 'fs';
import Promise from 'bluebird';
import { toFileURL, fromFileURL } from 'systemjs-builder/lib/utils';
import path from 'path';

ui.setResolver(this);
ui.useDefaults();

export function bundleJS(modules, fileName, opts, bundleOpts) {

  jspm.setPackagePath('.');
  var customCfg = {} // pass all sort of custom configuration like baseURL etc here.
  var builder = new jspm.Builder(customCfg);

  var outfile = path.resolve(fromFileURL(builder.loader.baseURL), fileName);

  if (!opts.sourceMaps) {
    removeExistingSourceMap(outfile);
  }

  if (fs.existsSync(outfile)) {
    if (!bundleOpts.force) {
      ui.log('err', 'A bundle named `' + outfile + '` is already exists. Use --force to overwrite.');
      return;
    }
    fs.unlinkSync(outfile);
  }

  var moduleExpression = modules.map(m => getFullModuleName(m, config.loader.__originalConfig.map)).join(' + ');

  console.log(moduleExpression);
  return builder.trace(moduleExpression)
    .then(function(buildTree) {
      logTree(buildTree);
      if (!('lowResSourceMaps' in opts))
        opts.lowResSourceMaps = true;
      return builder.buildTree(buildTree, outfile, opts);
    })
    .then(function(output) {
      delete config.loader.depCache;
      if (opts.inject) injectBundle(builder, fileName, output);
    })
    .then(config.save)
    .then(function() {
      logBuild(path.relative(process.cwd(), fileName), opts);
    })
    .catch(function(e) {
      ui.log('err', e.stack || e);
      throw e;
    });
};

function injectBundle(builder, fileName, output) {
  var bundleName = builder.getCanonicalName(toFileURL(path.resolve(config.pjson.baseURL, fileName)));
  if (!config.loader.bundles) {
    config.loader.bundles = {};
  }
  config.loader.bundles[bundleName] = output.modules;
  ui.log('ok', '`' + bundleName + '` added to config bundles.');
}

function logTree(tree) {
  ui.log('info', '');
  tree = alphabetize(tree);
  for (var name in tree)
    ui.log('info', '  `' + name + '`');
  ui.log('info', '');
}

function logModules(modules) {
  ui.log('info', '');
  modules.forEach(m => {
    ui.log('info', '  `' + m + '`');
  });
  ui.log('info', '');
}

function removeExistingSourceMap(outfile) {
  var mapFile = outfile + '.map'
  if (fs.existsSync(mapFile)) {
    fs.unlinkSync(mapFile);
  }
}

function logBuild(outFile, opts) {
  var resolution = opts.lowResSourceMaps ? '' : 'high-res ';
  ui.log('ok', 'Built into `' + outFile + '`' +
    (opts.sourceMaps ? ' with ' + resolution + 'source maps' : '') + ', ' +
    (opts.minify ? '' : 'un') + 'minified' +
    (opts.minify ? (opts.mangle ? ', ' : ', un') + 'mangled.' : '.'));
}

function getFullModuleName(moduleName, map) {
  var matches = [];

  Object.keys(map)
    .forEach(m => {
      if (m.startsWith(moduleName)) {
        matches.push(m);
      }
    });

  if (matches.length === 0) {
    return moduleName;
  }

  if (matches.length > 1) {
    ui.log('err', `Multiple mathces found for module: '${moduleName}'. Matches are:`);
    logModules(matches);
    ui.log('info', `Try including specific version number. Or, resolve the conflict with manually with 'jspm'`);
    throw 'Version conflict found in module names specified in `aureliafile`';
  }

  return matches[0];
}
