/** 项目品牌名称，供登录、布局和浏览器标题统一使用。 */
export const APP_TITLE = import.meta.env.VITE_APP_TITLE?.trim() || 'Antdv Next Admin';

/** 公共 Logo 随 Vite 部署前缀定位，供登录、布局与关于页面共用。 */
export const APP_LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;
