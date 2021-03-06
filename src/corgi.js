const commander = require('commander');
const path = require('path');
const exec = require('child_process').exec;
//import updateNotifier from 'update-notifier';
const util = require('./util');
const compile = require('./compile');

let displayVersion = () => {
    let version = util.getVersion();
    console.log('\n v' + version + '\n');
};

let generateProject = (name, config) => {

    util.log('目录：' + name, '创建');

    if (util.mkdir(name) !== true) {
        util.error('创建目录失败。');
        return;
    }

    process.chdir(name);
    util.currentDir = process.cwd();

    let packagePath = path.join(util.currentDir, 'package.json');

    if (util.isFile(packagePath) || util.isDir(path.join(util.currentDir, 'src'))) {
        util.error('目录不为空, 请请勿重复初始化', '错误');
        return;
    }

    const tplDir = '../templates/';
    const templateDir = path.join(util.cliDir, tplDir + 'default', path.sep);
    const emptyDir = path.join(util.cliDir, tplDir + 'empty', path.sep);

    let template = config.empty ? emptyDir : templateDir;

    const useMobx = !config.empty && config.mobx;

    let pkg = path.join(template, 'package.json');
    pkg = util.readFile(pkg);
    pkg = JSON.parse(pkg);
    pkg.name = name;

    let dependencies = [];
    let devDependencies = [
        'babel-plugin-transform-decorators-legacy',
        'babel-plugin-syntax-export-extensions',
        'babel-plugin-transform-export-extensions',
        'babel-plugin-transform-runtime',
        'babel-preset-es2015',
        'babel-preset-stage-1',
        'babel-runtime',
        'wepy-compiler-sass',
        'wepy-compiler-babel',
    ];
    const eslintDeps = [
        'eslint@3.18.0',
        'babel-eslint@7.2.1',
        'eslint-config-standard@7.1.0',
        'eslint-friendly-formatter@2.0.7',
        'eslint-plugin-html@2.0.1',
        'eslint-plugin-promise@3.5.0',
        'eslint-plugin-standard@2.0.1',
        'wepy-eslint'
    ];
    const mobxDeps = [
        'mobx',
        'mobx-weapp'
    ];

    if (!config.empty) {
        dependencies.push('wepy-com-toast');
        dependencies.push('wepy-async-function');
    }

    if (useMobx) {
        // concat more faster than push.apply
        dependencies = dependencies.concat(mobxDeps);
    }

    if (config.lint) {
        devDependencies = devDependencies.concat(eslintDeps);
    }

    util.writeFile(packagePath, JSON.stringify(pkg));
    util.log('配置: ' + 'package.json', '写入');

    let files = util.getFiles(template);

    const copyFn = function (sourcePath) {
        return function (file) {
            let target = path.join(util.currentDir, file);

            // --on-lint will not copy eslint config
            if (['.editorconfig', '.eslintignore', '.eslintrc'].indexOf(file) !== -1 && !config.lint)
                return;

            // 只有 redux 的项目拷贝 redux 相关内容 且做替换
            const defaultFiles = [
                path.join('src', 'app.js'),
                path.join('src', 'pages', 'index', 'index.js')
            ];
            const mobxFiles = [
                path.join('src', 'app-mobx.js'),
                path.join('src', 'pages', 'index', 'index-mobx.js')
            ];
            const index = mobxFiles.indexOf(file);
            if (useMobx) {
                if (defaultFiles.indexOf(file) !== -1) {
                    return;
                }
                // 将 mobxFile 的文件重新命名
                if (index >= 0) {
                    target = path.join(util.currentDir, defaultFiles[index]);
                }
            } else if (index !== -1 || file.indexOf(path.join('src', 'stores')) === 0) {
                // 同样排除 store 内容
                return;
            }

            let fileContent = util.readFile(path.join(sourcePath, file));
            if (file === 'wepy.config.js') {
                // if (1config.lint) {
                //     // replace eslint: true,
                //     fileContent = fileContent.replace(/\s*eslint\: true,/ig, '')
                // }
            }
            util.writeFile(target, fileContent);
            util.log('文件: ' + file, '拷贝');
        }
    }
    files.forEach(copyFn(template));

    let cmd = 'npm install --save ' + dependencies.join(' ');
    let cmdDev = 'npm install --save-dev ' + devDependencies.join(' ');
    util.log('执行命令: ' + cmd, '执行');
    util.log('执行命令: ' + cmdDev, '执行');
    util.log('可能需要几分钟, 请耐心等待...', '信息');
    // 不能并行执行安装依赖
    util.exec(cmd).then(d => {
        return util.exec(cmdDev)
    }).then(d => {
        util.log('安装依赖完成', '完成');

        let cmd = 'corgi build';
        util.log('执行命令: ' + cmd, '执行');
        util.log('可能需要几分钟, 请耐心等待...', '信息');

        util.exec(cmd).then(d => {
            util.log('代码编译完成', '完成');
            util.log('项目初始化完成, 可以开始使用小程序。', '完成');
        }).catch(e => {
            util.log('代码编译出错', '错误');
        })
    }).catch(e => {
        util.log('安装依赖出错', '错误');
    });
};

commander.usage('[command] <options ...>');
commander.option('-v, --version', '显示版本号', () => {
  displayVersion();
});
commander.option('-V', '显示版本号', () => {
  displayVersion();
});
commander.option('-s, --source <source>', '源码目录');
commander.option('-t, --target <target>', '生成代码目录');
commander.option('-f, --file <file>', '待编译wpy文件');
commander.option('--no-cache', '对于引用到的文件，即使无改动也会再次编译');
commander.option('--empty', '使用new生成项目时，生成空项目内容');
commander.option('--no-lint', '使用new生成项目时，禁用eslint');
commander.option('--mobx', '使用new生成项目时，增加mobx相关内容');
commander.option('-w, --watch', '监听文件改动');
commander.option('--notify', 'compile error系统通知');

commander.command('build').description('编译项目').action(projectPath => {
    if (!util.isDir(path.join(util.currentDir, 'node_modules'))) {
        util.error('请先执行npm install安装所需依赖', '错误');
        return;
    } else {
        compile.build(commander);
    }
});

commander.command('new <projectName>').description('生成项目').action(name => {
    generateProject(name || 'corgi-app', commander);
});


commander.parse(process.argv);
