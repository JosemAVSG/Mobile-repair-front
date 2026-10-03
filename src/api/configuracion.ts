import { ApiClient } from './ApiClient';
import type { BackendShopConfig, ShopConfigForm } from '../types';

export const getPublicConfig = async (): Promise<BackendShopConfig> => {
  return ApiClient.get<BackendShopConfig>('/api/configuracion/public');
};

export const getConfig = async (): Promise<BackendShopConfig> => {
  return ApiClient.get<BackendShopConfig>('/api/configuracion');
};

/** Si `logo` es un File se envía multipart/form-data; si es string o null, JSON. */
export const updateConfig = async (
  values: ShopConfigForm,
): Promise<BackendShopConfig> => {
  if (values.logo instanceof File) {
    const formData = new FormData();
    formData.append('nombreTaller', values.nombreTaller);
    formData.append('logo', values.logo);
    // axios setea el Content-Type multipart con boundary automáticamente.
    return ApiClient.put<BackendShopConfig>('/api/configuracion', formData);
  }

  return ApiClient.put<BackendShopConfig>('/api/configuracion', {
    nombreTaller: values.nombreTaller,
    logo: values.logo,
  });
};