/*global process,module*/

module.exports.runArgvExpression = runArgvExpression;

function runArgvExpression() {
  if (!process.argv.includes("-e")) return false;

  let idx = process.argv.indexOf("-e"),
      expr = process.argv[idx+1];

  if (!expr) {
    console.error(`expected expression following -e`);
    process.exit(1);
  }
  
  new Promise(async (resolve, reject) => {
    try {
      let result = eval(expr);
      if (result instanceof Promise) result = await result;
      resolve(result);
      if (typeof result !== "undefined") console.log(result);
      process.exit(0);
    } catch (err) {
      console.error(err);
      reject(err);
      process.exit(1);
    }
  });

  return true;
}
