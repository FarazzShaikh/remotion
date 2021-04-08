import path from 'path';
import {Internals, WebpackConfiguration, WebpackOverrideFn} from 'remotion';
import webpack, {ProgressPlugin} from 'webpack';
import {getWebpackCacheName} from './webpack-cache';

const ErrorOverlayPlugin = require('@webhotelier/webpack-fast-refresh/error-overlay');
const ReactRefreshPlugin = require('@remotion/fast-refresh');

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T;
function truthy<T>(value: T): value is Truthy<T> {
	return Boolean(value);
}

const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');

const smp = new SpeedMeasurePlugin();

export const webpackConfig = ({
	entry,
	userDefinedComponent,
	outDir,
	environment,
	webpackOverride = (f) => f,
	onProgressUpdate,
	enableCaching = Internals.DEFAULT_WEBPACK_CACHE_ENABLED,
	inputProps,
}: {
	entry: string;
	userDefinedComponent: string;
	outDir: string;
	environment: 'development' | 'production';
	webpackOverride?: WebpackOverrideFn;
	onProgressUpdate?: (f: number) => void;
	enableCaching?: boolean;
	inputProps?: object;
}): WebpackConfiguration => {
	return webpackOverride({
		optimization: {
			minimize: false,
			splitChunks: false,
		},
		experiments: {
			lazyCompilation:
				environment === 'production'
					? false
					: {
							entries: false,
					  },
		},
		cache: enableCaching
			? {
					type: 'filesystem',
					name: getWebpackCacheName(environment, inputProps ?? {}),
			  }
			: false,
		devtool: 'cheap-module-source-map',
		stats: 'verbose',

		entry: [
			environment === 'development'
				? require.resolve('webpack-hot-middleware/client')
				: null,
			environment === 'development'
				? require.resolve('@remotion/fast-refresh/dist/runtime')
				: null,
			userDefinedComponent,
			require.resolve('../react-shim.js'),
			entry,
		].filter(Boolean) as [string, ...string[]],
		mode: environment,
		plugins:
			environment === 'development'
				? [
						new ErrorOverlayPlugin(),
						new ReactRefreshPlugin(),
						new webpack.HotModuleReplacementPlugin(),
						new webpack.DefinePlugin({
							'process.env.INPUT_PROPS': JSON.stringify(inputProps ?? {}),
						}),
				  ]
				: [
						new ProgressPlugin((p) => {
							if (onProgressUpdate) {
								onProgressUpdate(Number((p * 100).toFixed(2)));
							}
						}),
				  ],
		output: {
			globalObject: 'this',
			filename: 'bundle.js',
			path: outDir,
		},
		devServer: {
			contentBase: path.resolve(__dirname, '..', 'web'),
			historyApiFallback: true,
			hot: true,
		},
		resolve: {
			extensions: ['.ts', '.tsx', '.js', '.jsx'],
			alias: {
				// Only one version of react
				'react/jsx-runtime': require.resolve('react/jsx-runtime'),
				react: require.resolve('react'),
				remotion: require.resolve('remotion'),
				'styled-components': require.resolve('styled-components'),
				'react-native$': 'react-native-web',
			},
		},
		module: {
			rules: [
				{
					test: /\.(woff|woff2)$/,
					use: {
						loader: require.resolve('url-loader'),
					},
				},
				{
					test: /\.css$/i,
					use: [require.resolve('style-loader'), require.resolve('css-loader')],
				},
				{
					test: /\.(png|svg|jpg|jpeg|webp|gif|bmp|webm|mp4|mp3|wav|aac)$/,
					use: [
						{
							loader: require.resolve('file-loader'),
							options: {
								// So you can do require('hi.png')
								// instead of require('hi.png').default
								esModule: false,
							},
						},
					],
				},
				{
					test: /\.tsx?$/,
					use: [
						require.resolve('@remotion/fast-refresh/dist/loader'),
						{
							loader: require.resolve('esbuild-loader'),
							options: {
								loader: 'tsx',
								target: 'chrome85',
							},
						},
					].filter(truthy),
				},
				{
					test: /\.jsx?$/,
					loader: require.resolve('esbuild-loader'),
					options: {
						loader: 'jsx',
						target: 'chrome85',
					},
				},
			],
		},
	});
};
