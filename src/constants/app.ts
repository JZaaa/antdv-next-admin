/** 项目品牌名称，供登录、布局和浏览器标题统一使用。 */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE?.trim() || 'Antdv Next Admin';

/** 当前项目作者与公开联系方式。 */
export const APP_AUTHOR = 'JZaaa';
export const APP_CONTACT_EMAIL = 'lih6633319@gmail.com';

/** 当前维护仓库，供关于页和账号菜单共用。 */
export const APP_REPOSITORY = 'JZaaa/antdv-next-admin';
export const APP_REPOSITORY_URL = `https://github.com/${APP_REPOSITORY}`;

/** 公共 Logo 随 Vite 部署前缀定位，供登录、布局与关于页面共用。 */
export const APP_LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;
