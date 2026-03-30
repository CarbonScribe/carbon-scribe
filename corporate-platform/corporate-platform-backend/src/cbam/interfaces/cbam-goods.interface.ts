export interface CbamSector {
  code: string;
  name: string;
  description?: string;
}

export interface CbamGood {
  id?: string;
  companyId: string;
  cnCode: string;
  goodsName: string;
  sector: CbamSectorType;
  defaultValue?: number;
  unit: string;
}

export type CbamSectorType = 
  | 'CEMENT'
  | 'IRON_STEEL'
  | 'ALUMINIUM'
  | 'FERTILIZERS'
  | 'ELECTRICITY'
  | 'HYDROGEN';

export interface CbamGoodsFilter {
  sector?: CbamSectorType;
  cnCode?: string;
  companyId?: string;
}
