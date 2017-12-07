#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const RE_NEWLINE = /\n/
const RE_FUNCTION = /([a-zA-Z_][a-zA-Z0-9_]+)\((.+)?\)/

const OUTPUT_HEADER = `/* THIS FILE IS AUTO GENERATED */
#define function_execute
var _n = argument[0],
    _i = asset_get_index("{FUNCTION_NAME_PREFIX}" + _n);

if (!script_exists(_i)) {
    show_error("Unsupported function for function_execute: " + string(_n), true);
    return;
}

var _args = array_create(argument_count - 1, undefined);
for(var i = 1;i < argument_count;i ++) {
    _args[i - 1] = argument[i];
}

return script_execute(_i, _args);

#define function_execute_array
var _n = argument[0],
    _i = asset_get_index("{FUNCTION_NAME_PREFIX}" + _n);

if (!script_exists(_i)) {
    show_error("Unsupported function for function_execute_array: " + string(_n), true);
    return;
}

var _args = (argument_count > 1) ? argument[1] : [];

return script_execute(_i, _args);\n/* EDIT PAST THIS POINT AT YOUR OWN PERIL */\n`

const MAX_ARGUMENT_COUNT = 17

const NORETURN_FUNCTIONS = [
  /* THIS LIST WILL LIKELY GROW OVER TIME AS FUNCTIONS ARE DISCOVERED */
]

const BAD_FUNCTIONS = [
  /* THIS LIST WILL LIKELY GROW OVER TIME AS FUNCTIONS ARE DISCOVERED */
  'gml_pragma',
  'font_replace'
]

const main = () => {
  const now = Date.now()
  const [fnames] = process.argv.slice(2)

  if (fnames === undefined) {
    console.log(`Usage: ${path.basename(__filename)} <fnames>`)

    return
  }

  fs.access(fnames, (err) => {
    if (err) throw err

    fs.readFile(fnames, { encoding: 'utf-8' }, (err, data) => {
      if (err) throw err

      const lines = data.split(RE_NEWLINE).filter((x) => x.trim())
      const parsed = {}

      for (const line of lines) {
        if (!line.startsWith('/')) {
          const matches = RE_FUNCTION.exec(line)

          if (matches) {
            const name = matches[1]

            if (!BAD_FUNCTIONS.includes(name)) {
              const args = matches[2] ? matches[2].split(',').filter((x) => x.trim()) : []

              const varg = args.length > 0 && (args[0].indexOf('.') >= 0 || args.join(',').indexOf(',.') >= 0)

              parsed[name] = {
                name: name,
                argc: varg ? -1 : args.length,
                returns: !NORETURN_FUNCTIONS.includes(name)
              }
            }
          }
        }
      }

      let output = OUTPUT_HEADER.replace(/\{FUNCTION_NAME_PREFIX\}/g, `__function_execute_${now}_`)

      for (const name in parsed) {
        const data = parsed[name]

        output += `#define __function_execute_${now}_${name}\nvar _a = argument[0];\n`

        if (data.argc >= 0) {
          const args = Array.apply(null, Array(data.argc)).map((x, i) => `_a[${i}]`)

          output += `${data.returns ? 'return ' : ''}${name}(${args.join(',')});\n`
        } else {
          output += 'switch(array_length_1d(_a)) {\n'
          for (let i = 0; i < MAX_ARGUMENT_COUNT; i++) {
            const args = Array.apply(null, Array(i)).map((x, k) => `_a[?${k}]`)
            output += `    case ${i}: ${data.returns ? 'return ' : ''}${name}(${args.join(',')})\n`
          }
          output += '}\n'
          output += 'return undefined;\n'
        }
      }

      fs.writeFile('dist.gml', output, { encoding: 'utf-8' }, (err) => {
        if (err) throw err
      })
    })
  })
}

main()
