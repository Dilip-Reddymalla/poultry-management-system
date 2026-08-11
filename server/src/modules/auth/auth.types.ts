export interface SafeUser{
    id:string;
    employeeId: string;
    email: string;
    employee: {
        name: string;
        designation: string;
    };
    roles: string[]
}