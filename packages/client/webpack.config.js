import path from "path";
import url from 'url';
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import ResolveTypeScriptPlugin from "resolve-typescript-plugin";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default function(env, { mode }) {
  const production = mode === 'production';
  return {
    mode: production ? 'production' : 'development',
    devtool: production ? 'source-map' : 'inline-source-map',
    entry: {
      app: ['./src/main.ts']
    },
    output: {
      filename: 'bundle.js',
      publicPath:'/'
    },
    resolve: {
      extensions: ['.ts', '.js'],
      modules: ['src', 'node_modules'],
      plugins: [new ResolveTypeScriptPlugin()]
    },
    devServer: {
      port: 9000,
      historyApiFallback: true,
      open: !process.env.CI,
      devMiddleware: {
        writeToDisk: true,
      },
      static: {
        directory: path.join(__dirname, './')
      }
    },
    plugins: [
      new CleanWebpackPlugin()
    ],
    stats: {
      errorDetails: true
    },
    module: {
      rules: [
        {
          test: /\.ts$/i,
          use: [
            {
              loader: 'ts-loader',
              options: {
                "projectReferences": true
              }
            }
          ],
          exclude: /node_modules/
        }
      ]
    }
  }
}